import { DateTime } from 'luxon';

import { logger as mainLogger } from '~~/server/utils/logger';
import { Prisma, InstagramPostScrapeRecord, UrlSource, UrlEvent } from '@prisma/client';
import { SourceFile, UrlEventInit, UrlScraper, UrlSourceInit } from '../http';
import vision from '@google-cloud/vision';
import { OpenAiInstagramResult, OpenAiInstagramEvent, extractInstagramEvent } from '../openai';

import { prisma } from '~~/server/utils/db';
import { InstagramApiPost } from '~~/types';
import { instagramRateLimitHeader, instagramTokenExpireAt, instagramPostSkip } from '../metrics';

const logger = mainLogger.child({ provider: 'instagram' });

if (!process.env.INSTAGRAM_BUSINESS_USER_ID) {
	throw new Error('INSTAGRAM_BUSINESS_USER_ID not found.');
}
if (!process.env.OPENAI_API_KEY) {
	throw new Error('OPENAI_API_KEY not found.');
}

export class InstagramScraper implements UrlScraper {
	name = 'instagram';

	async scrape(source: UrlSource): Promise<UrlEventInit[]> {
		if (!source.sourceID) {
			throw new Error(`Instagram sources must have sourceID, source ${source.id} did not have one!`);
		}

		const token = await getInstagramToken();

		const igSource: InstagramSource = {
			username: source.sourceID,
			contextClues: JSON.parse(source.extraDataJson).contextClues,
			...source,
		};

		const posts = await fetchPosts(token, igSource);

		const maybeEvents = await Promise.all(posts.map((post) => handleInstagramPost(igSource, post)));

		const events: UrlEventInit[] = [];
		for (let maybeEvent of maybeEvents) {
			if (maybeEvent) {
				events.push(maybeEvent);
			}
		}

		logger.debug({ events, username: source.sourceID }, 'scraped events');

		return events;
	}

	async createdEventCallback(_source: UrlSource, events: UrlEvent[]): Promise<void> {
		for (let e of events) {
			await prisma.instagramPostScrapeRecord.updateMany({
				where: {
					url: e.url,
				},
				data: {
					eventId: e.id,
				},
			});
		}
	}

	generateSources(sources: SourceFile): UrlSourceInit[] {
		return sources.instagram.map((source) => {
			return {
				sourceName: source.username,
				sourceCity: source.city,
				sourceID: source.username,
				// This URL is not actually used, we generate the URL at scrape-time so that we don't store tokens in the DB
				url: `https://instagram.com/${source.username}`,
				extraData: {
					contextClues: source.context_clues,
				},
			};
		});
	}
}

export interface InstagramSource extends UrlSource {
	contextClues: string[];
	username: string;
}

interface InstagramImageInit {
	url: string;
	data: ArrayBuffer;
}

async function fetchOcrResults(images: InstagramImageInit[]): Promise<string[]> {
	if (!process.env.GOOGLE_CLOUD_VISION_PRIVATE_KEY) {
		throw new Error('GOOGLE_CLOUD_VISION_PRIVATE_KEY not found.');
	}
	if (!process.env.GOOGLE_CLOUD_VISION_CLIENT_EMAIL) {
		throw new Error('GOOGLE_CLOUD_VISION_CLIENT_EMAIL not found.');
	}
	const client = new vision.ImageAnnotatorClient({
		scopes: ['https://www.googleapis.com/auth/cloud-platform'],
		credentials: {
			private_key: process.env.GOOGLE_CLOUD_VISION_PRIVATE_KEY.replace(/\\n/g, '\n'),
			client_email: process.env.GOOGLE_CLOUD_VISION_CLIENT_EMAIL,
		},
	});

	const annotationsAll = await Promise.all(
		images.map(async (image) => {
			const [result] = await client.textDetection(Buffer.from(image.data));
			const annotations =
				result.textAnnotations && result.textAnnotations.length > 0 ? result.fullTextAnnotation?.text || '' : '';

			logger.debug({ url: image.url, result, annotations }, 'Executed OCR on image');
			return annotations;
		}),
	);

	return annotationsAll;
}

function instagramURL(token: string, sourceUsername: string) {
	return (
		`https://graph.facebook.com/v16.0/${process.env.INSTAGRAM_BUSINESS_USER_ID}?fields=` +
		`business_discovery.username(${sourceUsername}){media.limit(5){caption,permalink,timestamp,media_type,media_url,children{media_url,media_type}}}` +
		`&access_token=${token}`
	);
}

export class RateLimitError extends Error {
	callCount: number;
	cpuTime: number;
	totalTime: number;

	constructor(callCount: number, cpuTime: number, totalTime: number) {
		super(`Instagram rate limit hit: calls: ${callCount}, cpuTime: ${cpuTime}, time: ${totalTime}`);
		this.name = 'RateLimitError';

		this.callCount = callCount;
		this.cpuTime = cpuTime;
		this.totalTime = totalTime;
	}
}

// Fetches the five most recent posts from the given Instagram account.
async function fetchPosts(token: string, source: InstagramSource): Promise<InstagramApiPost[]> {
	const response = await fetch(instagramURL(token, source.username));

	const rateLimitHeader = response.headers.get('X-App-Usage');
	if (rateLimitHeader) {
		const appUsage = JSON.parse(rateLimitHeader);

		const callCount = appUsage.call_count;
		const totalCPUTime = appUsage.total_cputime;
		const totalTime = appUsage.total_time;

		instagramRateLimitHeader.labels('call_count').set(callCount);
		instagramRateLimitHeader.labels('total_cputime').set(totalCPUTime);
		instagramRateLimitHeader.labels('total_time').set(totalTime);

		if (callCount >= 100 || totalCPUTime >= 100 || totalTime >= 100) {
			throw new RateLimitError(callCount, totalCPUTime, totalTime);
		}

		logger.debug({ appUsage, username: source.username }, 'Current rate limit');
	}

	const responseBody = await response.json();

	if (responseBody.error) {
		throw new Error(responseBody.error.message);
	}

	if (
		!responseBody.business_discovery ||
		!responseBody.business_discovery.media ||
		!responseBody.business_discovery.media.data
	) {
		logger.warn(
			{
				sourceType: source.sourceType,
				source: source.sourceName,
				response: responseBody,
			},
			'Got invalid API response from Instagram',
		);

		return [];
	}

	return responseBody.business_discovery.media.data;
}

async function extractEventFromPost(
	source: InstagramSource,
	post: InstagramApiPost,
	images: InstagramImageInit[],
): Promise<UrlEventInit | null> {
	const imageText = await extractTextFromPostImages(post, images);

	const inference = await runInferenceOnPost(source, post, imageText);
	if (!inference) {
		return null;
	}

	if (!inference.event) {
		return null;
	}

	return buildEvent(inference.event, post, images);
}

function buildEvent(
	inferenceEvent: OpenAiInstagramEvent,
	post: InstagramApiPost,
	images: InstagramImageInit[],
): UrlEventInit | null {
	const event = {
		start: DateTime.fromISO(inferenceEvent.start).toJSDate(),
		end: DateTime.fromISO(inferenceEvent.end).toJSDate(),
		url: post.permalink,
		title: inferenceEvent.title,
		description: post.caption,
		images,
	};

	logger.debug(
		{ postUrl: post.permalink, event, eventTitle: event.title },
		'generated event details from ai inference',
	);

	return event;
}

async function runInferenceOnPost(
	source: InstagramSource,
	post: InstagramApiPost,
	ocrResult: string[] | null,
): Promise<OpenAiInstagramResult | null> {
	try {
		const result = await extractInstagramEvent(source, post, ocrResult || []);

		logger.debug({ username: source.username, postUrl: post.permalink, result }, 'Performed inference on post');

		return result;
	} catch (e) {
		logger.error(
			{ sourceName: source.username, postUrl: post.permalink, error: e },
			'error running instagram post inference',
		);

		throw e;
	}
}

function getMediaUrls(post: InstagramApiPost): string[] | null {
	switch (post.media_type) {
		case 'IMAGE':
			// May be omitted for legal reasons.
			if (post.media_url) {
				return [post.media_url];
			}

			return null;
		case 'CAROUSEL_ALBUM':
			return (
				(post.children || { data: [] }).data
					.map((child) => child.media_url)
					// Keep only if defined, since it may be omitted.
					.filter((mediaUrl) => mediaUrl)
			);
		case 'VIDEO':
			// TODO: We can OCR the thumbnail_url, but due to a bug on Instagram's end we cannot access the `thumbnail_url` field.
			// See https://developers.facebook.com/support/bugs/3431232597133817/?join_id=fa03b2657f7a9c for updates.
			return null;
		default:
			logger.error({ event: post }, `Unknown media type: ${post.media_type}`);
			return null;
	}
}

async function extractTextFromPostImages(
	post: InstagramApiPost,
	images: InstagramImageInit[],
): Promise<string[] | null> {
	const text = await fetchOcrResults(images);
	logger.debug({ text, postID: post.id, postURL: post.permalink }, 'Performed OCR text extraction on post');

	return text;
}

/*
 * Stores the post from the IG API in the database returning the model, returns `null` if the post already existed
 */
async function hasPostBeenScraped(source: UrlSource, post: InstagramApiPost): Promise<boolean> {
	try {
		await prisma.instagramPostScrapeRecord.create({
			data: {
				id: post.id,
				url: post.permalink,
				sourceId: source.id,
				scrapeModel: '6l01',
			},
		});

		return false;
	} catch (e) {
		if (e instanceof Prisma.PrismaClientKnownRequestError) {
			// This is the response code for a unique constraint violation - IE "the post id was already in the DB"
			if (e.code === 'P2002') {
				return true;
			}
		}

		throw e;
	}
}

/**
 * Takes a given post, runs extractors on it if it's new, persists it to the
 * database as an Event if extractors determine it's an event
 * @param source
 * @param apiPost
 * @returns
 */
async function handleInstagramPost(source: InstagramSource, apiPost: InstagramApiPost): Promise<UrlEventInit | null> {
	if (apiPost.media_type != 'IMAGE') {
		instagramPostSkip.inc({ reason: 'non-image' });
		return null;
	}

	if (await hasPostBeenScraped(source, apiPost)) {
		instagramPostSkip.inc({ reason: 'already-scraped' });
		return null;
	}

	try {
		const dt = DateTime.fromISO(apiPost.timestamp);
		if (dt && dt.diffNow().as('days') > 30) {
			instagramPostSkip.inc({ reason: 'too-old' });
			logger.warn(
				{
					sourceType: source.sourceType,
					source: source.sourceName,
					url: apiPost.permalink,
					postTime: dt,
				},
				'Skipping Instagram scrape for event more than 30d in the past',
			);
			return null;
		}

		const mediaUrls = getMediaUrls(apiPost);

		const images = mediaUrls ? await fetchImages(mediaUrls) : [];

		const maybeEvent = await extractEventFromPost(source, apiPost, images);
		if (!maybeEvent) {
			instagramPostSkip.inc({ reason: 'un-extractable' });
			return null;
		}

		return maybeEvent;
	} catch (e) {
		logger.error(
			{
				sourceType: source.sourceType,
				source: source.sourceName,
				url: apiPost.permalink,
				post: apiPost,
				error: e,
			},
			'failed to process instagram post',
		);

		await prisma.instagramPostScrapeRecord.deleteMany({
			where: {
				url: apiPost.permalink,
			},
		});

		throw e;
	}
}

async function fetchImages(mediaUrls: string[]): Promise<InstagramImageInit[]> {
	return await Promise.all(
		mediaUrls.map(async (url) => {
			const response = await fetch(url);
			const data = await response.arrayBuffer();

			return {
				url,
				data,
			};
		}),
	);
}

// Loads a token from the database, throws an error if no tokens are available.
async function getInstagramToken(): Promise<string> {
	const row = await prisma.instagramToken.findFirst({
		select: {
			token: true,
			expiresAt: true,
		},
		where: {
			expiresAt: { gt: new Date() },
		},
		orderBy: {
			expiresAt: 'desc',
		},
	});

	if (!row) {
		const runtimeConfig = useRuntimeConfig();
		throw new Error(`No valid Instagram tokens! Visit ${runtimeConfig.public.baseUrl}/fb-login/ to refresh!`);
	}

	instagramTokenExpireAt.set(row.expiresAt.getTime() / 1000);

	return row.token;
}
