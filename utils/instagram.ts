import { InstagramEvent, InstagramEventOrganizer, InstagramImage, InstagramPost, Prisma } from "@prisma/client";
import { Configuration, OpenAIApi } from "openai";
import { logger as mainLogger } from './logger';
import { prisma } from '~~/utils/db';

import vision from '@google-cloud/vision';
import { InstagramApiPost, InstagramSource } from "~~/types";
import { DateTime } from "luxon";
import { OpenAiInstagramResult, instagramInitialPrompt, executePrompt } from "./openai";
import eventSourcesJSON from 'public/event_sources.json';

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
const logger = mainLogger.child({ provider: 'instagram' });

async function fetchOcrResults(images: InstagramImage[]) {
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
			const [result] = await client.textDetection(image.data);
			const annotations = (result.textAnnotations && result.textAnnotations.length > 0) ?
				result.fullTextAnnotation?.text || '' : '';

			logger.debug({ url: image.url, imageID: image.id, postID: image.postID, result, annotations }, 'Executed OCR on image');
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

// Fetches the five most recent posts from the given Instagram account.
async function fetchPosts(organizer: InstagramEventOrganizer): Promise<InstagramApiPost[]> {
	const response = await fetch(instagramURL(organizer.username));

	const rateLimitHeader = response.headers.get('X-App-Usage');
	if (rateLimitHeader) {
		const appUsage = JSON.parse(rateLimitHeader);

		const callCount = appUsage.call_count;
		const totalCPUTime = appUsage.total_cputime;
		const totalTime = appUsage.total_time;
		if (callCount >= 100 || totalCPUTime >= 100 || totalTime >= 100) {
			// TODO: handle this more gracefully
			throw new Error(`Instagram rate limit hit: calls: ${callCount}, cpuTime: ${totalCPUTime}, time: ${totalTime}`);
		}

		logger.debug({ appUsage, username: organizer.username }, 'Current rate limit')
	}

	const responseBody = await response.json();

	if (responseBody.error) {
		throw new Error(responseBody.error.message);
	}

	return responseBody.business_discovery.media.data;
}

async function extractEventFromPost(organizer: InstagramEventOrganizer, post: InstagramPost, images: InstagramImage[]): Promise<InstagramEvent | null> {
	const imageText = await extractTextFromPostImages(post, images);

	const inference = await runInferenceOnPost(organizer, post, imageText);
	if (!inference) {
		return null;
	}

	return await persistEvent(inference, post, organizer);
}

async function persistEvent(inference: OpenAiInstagramResult, post: InstagramPost, organizer: InstagramEventOrganizer): Promise<InstagramEvent | null> {
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

		const event = await prisma.instagramEvent.create({
			data: {
				postID: post.id,
				start: start.toUTC().toJSDate(),
				end: end.toUTC().toJSDate(),
				url: post.url,
				title: `${inference.title} @ ${organizer.username}`,
				organizerId: post.organizerId
			}
		});

		logger.debug({ postID: event.postID, eventTitle: event.title }, 'Persisted event to database');

		await prisma.instagramPost.update({
			where: { id: post.id },
			data: {
				completedAt: new Date(),
			}
		});

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

async function runInferenceOnPost(organizer: InstagramEventOrganizer, post: InstagramPost, ocrResult: string | null): Promise<OpenAiInstagramResult | null> {
	const initialPrompt = instagramInitialPrompt(organizer, post, ocrResult);
	logger.debug({ prompt: initialPrompt, organizer: organizer.username, postUrl: post.url }, 'Generated prompt for first round of inference')

	const initialResponse = await executePrompt(openai, initialPrompt);
	const generatedJson = initialResponse.choices[0].message?.content;
	if (!generatedJson) {
		return null;
	}

	// Todo: run verification prompt

	const result = postProcessOpenAiInstagramResponse(generatedJson);

	logger.debug({ organizer: organizer.username, postUrl: post.url, result }, 'Performed inference on post')

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

async function extractTextFromPostImages(post: InstagramPost, images: InstagramImage[]): Promise<string | null> {
	const text = await fetchOcrResults(images);
	logger.debug({ text, postID: post.id, postURL: post.url }, 'Performed OCR text extraction on post');

	return text;
}

async function getOrInsertOrganizer(source: InstagramSource): Promise<InstagramEventOrganizer> {
	const organizer = await prisma.instagramEventOrganizer.findUnique({ where: { username: source.username } });
	if (organizer) {
		return organizer;
	}

	return await prisma.instagramEventOrganizer.create({
		data: {
			username: source.username,
			city: source.city,
			contextClues: source.context_clues.join(' '),
			// Set lastUpdated to as early as possible so that it will be updated first.
			lastUpdated: new Date(0),
		}
	});
}

type PostResponse = {
	post: InstagramPost,

}

/*
* Stores the post from the IG API in the database returning the model, returns `null` if the post already existed
*/
async function persistPostNoneIfPresent(organizer: InstagramEventOrganizer, post: InstagramApiPost): Promise<InstagramPost | null> {
	const mediaUrls = JSON.stringify(getMediaUrls(post));

	try {
		return await prisma.instagramPost.create({
			data: {
				id: post.id,
				url: post.permalink,
				organizerId: organizer.id,
				caption: post.caption || '',
				postDate: new Date(post.timestamp),
			}
		});
	} catch (e) {
		if (e instanceof Prisma.PrismaClientKnownRequestError) {
			// This is the response code for a unique constraint violation - IE "the post id was already in the DB"
			if (e.code === 'P2002') {
				return null;
			}
		}

		throw e;
	}
}

/**
* Takes a given post, runs extractors on it if it's new, persists it to the
* database as an Event if extractors determine it's an event
* @param organizer
* @param apiPost
* @returns
*/
async function handleInstagramPost(organizer: InstagramEventOrganizer, apiPost: InstagramApiPost): Promise<InstagramEvent | null> {
	const dbPost = await persistPostNoneIfPresent(organizer, apiPost);
	if (!dbPost) {
		return null;
	}

	const mediaUrls = getMediaUrls(apiPost);

	const images = mediaUrls ? await fetchAndPersistImages(dbPost, mediaUrls) : [];

	const maybeEvent = await extractEventFromPost(organizer, dbPost, images);
	if (!maybeEvent) {
		return null;
	}

	return maybeEvent;
}

async function fetchAndPersistImages(post: InstagramPost, mediaUrls: string[]): Promise<InstagramImage[]> {
	return await Promise.all(mediaUrls.map(url => fetchAndPersistImage(post, url)));
}

async function fetchAndPersistImage(post: InstagramPost, url: string): Promise<InstagramImage> {
	const maybeImage = await prisma.instagramImage.findFirst({ where: { url } });
	if (maybeImage) {
		return maybeImage;
	}

	const response = await fetch(url);
	const data = await response.arrayBuffer();

	return prisma.instagramImage.create({
		data: {
			url,
			postID: post.id,
			data: Buffer.from(data),
		}
	})
}

async function ingestEventsForOrganizer(organizer: InstagramEventOrganizer): Promise<InstagramEvent[]> {
	try {
		const posts = await fetchPosts(organizer);

		const maybeEvents = await Promise.all(posts.map(post => handleInstagramPost(organizer, post)));

		const events: InstagramEvent[] = [];
		for (let maybeEvent of maybeEvents) {
			if (maybeEvent) {
				events.push(maybeEvent);
			}
		}

		await prisma.instagramEventOrganizer.update({ where: { id: organizer.id }, data: { lastUpdated: new Date() } })

		return events;
	} catch (e: any) {
		logger.error({ error: e.toString(), organizer: organizer.username }, 'error ingesting for organizer')
		return [];
	}
}

export async function scrapeInstagram(username: string | undefined) {
	logger.info({ username }, 'Starting Instagram data ingestion');
	let sources: InstagramSource[] = eventSourcesJSON.instagram;
	if (username) {
		sources = sources.filter(source => source.username === username);
	}

	const countsBySource = await Promise.all(sources.map(async source => {
		const organizer = await getOrInsertOrganizer(source);
		const events = await ingestEventsForOrganizer(organizer);

		return { source, eventCount: events.length };
	}));

	logger.info({ countsBySource, username }, 'Completed Instagram data ingestion');
}

export async function fixupInstagramIngestion(username: string | undefined, postID: string | undefined) {
	let extraCriteria = {};
	if (username) {
		extraCriteria = { organizer: { username } };
	}
	if (postID) {
		extraCriteria = { id: postID };
	}

	const incompletePosts = await prisma.instagramPost.findMany({
		where: {
			completedAt: null,
			InstagramEvent: null,
			...extraCriteria,
		},
		include: {
			organizer: true,
			InstagramEvent: true,
			images: true,
		},

	});

	logger.debug({ incompletePosts, username }, 'Fixing up posts');

	let eventCount = 0;
	await Promise.all(incompletePosts.map(async post => {
		if (await extractEventFromPost(post.organizer, post, post.images)) {
			eventCount += 1;
		}
	}));

	logger.info({ posts: incompletePosts.length, events: eventCount }, 'Completed post fixup process')
}

export interface FoundEvents {
	[organization_id: number]: { organization: InstagramEventOrganizer, events: InstagramEvent[] }
}

export interface FoundPosts {
	[organization_id: number]: { organization: InstagramEventOrganizer, posts: InstagramPost[] }
}

export async function findPosts(eventsWhere: any): Promise<FoundPosts> {
	const posts = await prisma.instagramPost.findMany({ where: eventsWhere });
	const organizers = await prisma.instagramEventOrganizer.findMany();
	const organizersById: FoundPosts = {};
	for (let organization of organizers) {
		organizersById[organization.id] = { organization, posts: [] };
	}

	for (let post of posts) {
		organizersById[post.organizerId].posts.push(post);
	}

	return organizersById;
}
