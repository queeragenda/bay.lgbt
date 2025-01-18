
import { DateTime } from 'luxon';

import { logger as mainLogger } from '~~/server/utils/logger';
import { Prisma, InstagramPostScrapeRecord, UrlSource } from '@prisma/client';
import { SourceFile, UrlEventInit, UrlScraper, UrlSourceInit } from '../http';
import { Configuration, OpenAIApi } from "openai";
import vision from '@google-cloud/vision';
import { OpenAiInstagramResult, instagramInitialPrompt, executePrompt } from "../openai";

import { prisma } from '~~/server/utils/db';
import { InstagramApiPost } from "~~/types";
import { instagramRateLimitHeader } from '../metrics';

const logger = mainLogger.child({ provider: 'instagram' });

if (!process.env.INSTAGRAM_BUSINESS_USER_ID) {
	throw new Error('INSTAGRAM_BUSINESS_USER_ID not found.');
}
if (!process.env.INSTAGRAM_USER_ACCESS_TOKEN) {
	throw new Error('INSTAGRAM_USER_ACCESS_TOKEN not found.');
}
if (!process.env.OPENAI_API_KEY) {
	throw new Error('OPENAI_API_KEY not found.');
}

const openai = new OpenAIApi(new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
}));

export class InstagramScraper implements UrlScraper {
	name = 'instagram';

	async scrape(source: UrlSource): Promise<UrlEventInit[]> {
		if (!source.sourceID) {
			throw new Error(`Instagram sources must have sourceID, source ${source.id} did not have one!`);
		}

		const igSource: InstagramSource = {
			username: source.sourceID,
			contextClues: JSON.parse(source.extraDataJson).contextClues,
			...source,
		};

		const posts = await fetchPosts(igSource);

		const maybeEvents = await Promise.all(posts.map(post => handleInstagramPost(igSource, post)));

		const events: UrlEventInit[] = [];
		for (let maybeEvent of maybeEvents) {
			if (maybeEvent) {
				events.push(maybeEvent);
			}
		}

		logger.debug({ events, username: source.sourceID }, 'scraped events');

		return events;
	}

	generateSources(sources: SourceFile): UrlSourceInit[] {
		return sources.instagram.map(source => {
			return {
				sourceName: source.username,
				sourceCity: source.city,
				sourceID: source.username,
				// This URL is not actually used, we generate the URL at scrape-time so that we don't store tokens in the DB
				url: `https://instagram.com/${source.username}`,
				extraData: {
					contextClues: source.context_clues,
				}
			};
		});
	}
}

export interface InstagramSource extends UrlSource {
	contextClues: string[]
	username: string
}

interface InstagramImageInit {
	url: string
	data: ArrayBuffer
}

async function fetchOcrResults(images: InstagramImageInit[]) {
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
			const annotations = (result.textAnnotations && result.textAnnotations.length > 0) ?
				result.fullTextAnnotation?.text || '' : '';

			logger.debug({ url: image.url, result, annotations }, 'Executed OCR on image');
			return annotations;
		}));

	const result = annotationsAll.join('\n');
	return result;
}

function instagramURL(sourceUsername: string) {
	return `https://graph.facebook.com/v16.0/${process.env.INSTAGRAM_BUSINESS_USER_ID}?fields=`
		+ `business_discovery.username(${sourceUsername}){media.limit(5){caption,permalink,timestamp,media_type,media_url,children{media_url,media_type}}}`
		+ `&access_token=${process.env.INSTAGRAM_USER_ACCESS_TOKEN}`
}

export class RateLimitError extends Error {
	callCount: number;
	cpuTime: number;
	totalTime: number;

	constructor(callCount: number, cpuTime: number, totalTime: number) {
		super(`Instagram rate limit hit: calls: ${callCount}, cpuTime: ${cpuTime}, time: ${totalTime}`);
		this.name = "RateLimitError";

		this.callCount = callCount;
		this.cpuTime = cpuTime;
		this.totalTime = totalTime;
	}
}

// Fetches the five most recent posts from the given Instagram account.
async function fetchPosts(source: InstagramSource): Promise<InstagramApiPost[]> {

	const response = await fetch(instagramURL(source.username));

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

		logger.debug({ appUsage, username: source.username }, 'Current rate limit')
	}

	const responseBody = await response.json();

	if (responseBody.error) {
		throw new Error(responseBody.error.message);
	}

	return responseBody.business_discovery.media.data;
}

async function extractEventFromPost(source: InstagramSource, post: InstagramApiPost, images: InstagramImageInit[]): Promise<UrlEventInit | null> {
	const imageText = await extractTextFromPostImages(post, images);

	const inference = await runInferenceOnPost(source, post, imageText);
	if (!inference) {
		return null;
	}

	return buildEvent(inference, post, source, images);
}

function buildEvent(inference: OpenAiInstagramResult, post: InstagramApiPost, source: InstagramSource, images: InstagramImageInit[]): UrlEventInit | null {
	if (inference.isEvent === true
		&& inference.startDay !== null
		&& inference.startHourMilitaryTime !== null
		&& inference.endHourMilitaryTime !== null
		&& inference.startMinute !== null
		&& inference.endMinute !== null
		&& inference.endDay !== null
		&& inference.hasStartHourInPost === true
		&& inference.isPastEvent === false
	) {
		let end = DateTime.fromObject(
			{
				year: inference.endYear || undefined,
				month: inference.endMonth || undefined,
				day: inference.startDay,
				hour: inference.endHourMilitaryTime,
				minute: inference.endMinute
			},
			{ zone: 'America/Los_Angeles' },
		);
		// Allow Luxon to automatically take care of overflow (i.e. day 32 of the month).
		end = end.plus({ days: inference.endDay - inference.startDay });

		const start = DateTime.fromObject(
			{
				year: inference.startYear || undefined,
				month: inference.startMonth || undefined,
				day: inference.startDay,
				hour: inference.startHourMilitaryTime,
				minute: inference.startMinute
			},
			{ zone: 'America/Los_Angeles' }
		);


		const event = {
			start: start.toUTC().toJSDate(),
			end: end.toUTC().toJSDate(),
			url: post.permalink,
			title: `${inference.title} @ ${source.username}`,
			description: post.caption,
			images,
		};

		logger.debug({ postUrl: post.permalink, event, eventTitle: inference.title }, 'generated event details from ai inference');

		return event;
	}

	return null;
}


function fixGeneratedJson(generatedJson: string): string {
	return generatedJson.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
}

function postProcessOpenAiInstagramResponse(generatedJson: string): OpenAiInstagramResult {
	const object = JSON.parse(fixGeneratedJson(generatedJson));

	const hasAllProperties = object && Object.hasOwn(object, 'isEvent')
		&& Object.hasOwn(object, 'title')
		&& Object.hasOwn(object, 'startHourMilitaryTime')
		&& Object.hasOwn(object, 'endHourMilitaryTime')
		&& Object.hasOwn(object, 'isPastEvent')
		&& Object.hasOwn(object, 'hasStartHourInPost')
		&& Object.hasOwn(object, 'startMinute')
		&& Object.hasOwn(object, 'endMinute')
		&& Object.hasOwn(object, 'startDay')
		&& Object.hasOwn(object, 'endDay')
		&& Object.hasOwn(object, 'startMonth')
		&& Object.hasOwn(object, 'endMonth')
		&& Object.hasOwn(object, 'startYear')
		&& Object.hasOwn(object, 'endYear');
	if (!hasAllProperties) {
		throw new Error('JSON does not contain expected fields');
	}

	// Post-processing.
	if (object.startYear === null) {
		object.startYear = new Date().getFullYear();
	}
	if (object.endYear === null) {
		object.endYear = object.startYear;
	}
	if (object.startMinute === null) {
		object.startMinute = 0;
	}
	if (object.endMinute === null) {
		object.endMinute = 0;
	}
	if (object.startMonth === 12 && object.endMonth === 1) {
		object.endYear = object.startYear + 1;
	}
	if (object.endMonth === null) {
		object.endMonth = object.startMonth;
	}
	if (object.endDay === null) {
		object.endDay = object.startDay;
	}
	if (object.endHourMilitaryTime === null) {
		// End 2 hours from startHourMilitaryTime
		object.endHourMilitaryTime = object.startHourMilitaryTime + 2;
		if (object.endHourMilitaryTime > 23) {
			object.endHourMilitaryTime -= 24;
			object.endDay = object.startDay + 1; // Would this overflow the month? Need to check.
		}
	}

	return object;
}

async function runInferenceOnPost(source: InstagramSource, post: InstagramApiPost, ocrResult: string | null): Promise<OpenAiInstagramResult | null> {
	const initialPrompt = instagramInitialPrompt(source, post, ocrResult);
	logger.debug({ prompt: initialPrompt, username: source.username, postUrl: post.permalink }, 'Generated prompt for first round of inference')

	const initialResponse = await executePrompt(openai, initialPrompt);
	const generatedJson = initialResponse.choices[0].message?.content;
	if (!generatedJson) {
		return null;
	}

	// Todo: run verification prompt

	const result = postProcessOpenAiInstagramResponse(generatedJson);

	logger.debug({ username: source.username, postUrl: post.permalink, result }, 'Performed inference on post')

	return result;
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
			return (post.children || { data: [] }).data
				.map((child) => child.media_url)
				// Keep only if defined, since it may be omitted.
				.filter((mediaUrl) => mediaUrl);
		case 'VIDEO':
			// TODO: We can OCR the thumbnail_url, but due to a bug on Instagram's end we cannot access the `thumbnail_url` field.
			// See https://developers.facebook.com/support/bugs/3431232597133817/?join_id=fa03b2657f7a9c for updates.
			return null;
		default:
			logger.error({ event: post }, `Unknown media type: ${post.media_type}`);
			return null;
	}
}

async function extractTextFromPostImages(post: InstagramApiPost, images: InstagramImageInit[]): Promise<string | null> {
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
			}
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
	if (await hasPostBeenScraped(source, apiPost)) {
		return null;
	}

	const mediaUrls = getMediaUrls(apiPost);

	const images = mediaUrls ? await fetchImages(mediaUrls) : [];

	const maybeEvent = await extractEventFromPost(source, apiPost, images);
	if (!maybeEvent) {
		return null;
	}

	return maybeEvent;
}

async function fetchImages(mediaUrls: string[]): Promise<InstagramImageInit[]> {
	return await Promise.all(mediaUrls.map(async url => {
		const response = await fetch(url);
		const data = await response.arrayBuffer();

		return {
			url,
			data,
		};
	}));
}
