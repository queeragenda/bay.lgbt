import { Prisma, UrlEvent, UrlEventImage, UrlSource } from "@prisma/client";
import { DateTime, Duration } from "luxon";
import { prisma } from "./db";
import { EventbriteScraper, EventbriteSingleScraper } from "./sources/eventbrite";
import { ForbiddenTicketsScraper } from "./sources/forbidden-tickets";
import { GcalScraper } from "./sources/google-calendar";
import { SquarespaceScraper } from "./sources/squarespace";
import { TimelyScraper } from "./sources/timely";
import { TockifyScraper } from "./sources/tockify";
import { WithFriendsScraper } from "./sources/with-friends";
import { WixScraper } from "./sources/wix";
import { WordpressTribeScraper } from "./sources/wordpress-tribe";
import eventSourcesJSON from '~~/server/utils/event_sources.json';
import { logger as mainLogger } from '~~/server/utils/logger';
import { EventLocation } from "~~/types";
import { InstagramScraper, RateLimitError } from "./sources/instagram";
import { eventsSaved, imagesSaved, instagramRateLimitErrors, scrapeCompleteCount, scrapeStartCount, scrapeTime } from "./metrics";

const logger = mainLogger.child({});

const SCRAPERS: UrlScraper[] = [
	new EventbriteScraper(),
	// new EventbriteSingleScraper(),
	new ForbiddenTicketsScraper(),
	new GcalScraper(),
	new SquarespaceScraper(),
	new TimelyScraper(),
	new TockifyScraper(),
	// new WithFriendsScraper(),
	// new WixScraper(),
	new WordpressTribeScraper(),
	new InstagramScraper(),
];
// This horribly ugly line turns the array of scrapers above into a map of scraper names to scraper instances
const SCRAPER_MAP: { [name: string]: UrlScraper } = Object.assign({}, ...SCRAPERS.map(s => ({ [s.name]: s })));

export type SourceFile = typeof eventSourcesJSON;
export interface UrlSourceInit {
	url: string
	sourceName: string
	sourceCity: string
	sourceID?: string
	extraData?: any
	unseenEventTTL?: Duration
	extractImagesFromBody?: boolean
}

export interface UrlEventInit {
	url: string
	title: string
	start: Date
	end: Date

	// These fields below will not actually get saved into the database
	description?: string
	location?: EventLocation
	images?: UrlEventImageInit[]
}

export interface UrlEventImageInit {
	url: string
	data?: ArrayBuffer
}

export interface UrlScraper {
	name: string

	scrape(source: UrlSource): Promise<UrlEventInit[]>
	generateSources(sources: SourceFile): UrlSourceInit[]
}

export interface UrlEventScrapeOptions {
	// Will only run the scrape for organizers that have not been updated since before the given time
	onlyUpdateStalerThan?: DateTime,
}

export async function initializeAllScrapers() {
	await Promise.all(SCRAPERS.map(async (scraper) => {
		const sourceInits = scraper.generateSources(eventSourcesJSON);

		await Promise.all(sourceInits.map(async sourceInit => {
			let extraDataJson = '{}';
			if (sourceInit.extraData) {
				extraDataJson = JSON.stringify(sourceInit.extraData);
			}

			let unseenEventTTLSecs;
			if (sourceInit.unseenEventTTL) {
				unseenEventTTLSecs = Math.floor(sourceInit.unseenEventTTL.toMillis() / 1000);
			}

			const urlSourceProperties = {
				url: sourceInit.url,
				sourceName: sourceInit.sourceName,
				sourceCity: sourceInit.sourceCity,
				sourceType: scraper.name,
				sourceID: sourceInit.sourceID,
				unseenEventTTLSecs,
				extractImagesFromBody: sourceInit.extractImagesFromBody,
				extraDataJson,
			}

			const source = await prisma.urlSource.findFirst({ where: { url: sourceInit.url }, select: { id: true } });
			if (source) {
				await prisma.urlSource.update({
					where: {
						id: source.id,
					},
					data: urlSourceProperties,
				});

				return;
			}

			await prisma.urlSource.create({
				data: {
					// If this field is not initialized to 0 (or at least an hour in the past), newly created sources will not be
					// scraped for the first hour of runtime, as the scrape job skips all sources that have been updated within
					// the past hour.
					lastScraped: new Date(0),
					...urlSourceProperties,
				}
			});
		}))
	}))
}

export interface IgScrapeOptions {
	username?: string,

	// Will only run the scrape for organizers that have not been updated since before the given time
	onlyUpdateStalerThan?: DateTime,
}

export async function scrapeInstagram(opts?: IgScrapeOptions) {
	logger.info({ opts }, 'Starting Instagram data ingestion');

	let lastScraped;
	if (opts?.onlyUpdateStalerThan) {
		lastScraped = {
			lte: opts.onlyUpdateStalerThan.toJSDate(),
		};
	}

	let sources = await prisma.urlSource.findMany({
		where: {
			sourceName: opts?.username,
			sourceType: 'instagram',
			lastScraped,
		},
		orderBy: {
			lastScraped: 'asc'
		},
	});

	const scraper = new InstagramScraper();

	const countsByOrganizer = [];
	for (let source of sources) {
		try {
			const events = await runScraperWithMetrics(source, scraper);

			const urlEvents = await persistNewEvents(source, events);

			countsByOrganizer.push({ source, eventCount: urlEvents.length });

			await prisma.urlSource.update({
				data: {
					lastScraped: new Date(),
				},
				where: {
					id: source.id,
				},
			});
		} catch (e: any) {
			logger.error({ error: e.toString(), source: source.sourceName, stack: e.stack }, 'error ingesting for instagram user')

			// If there was a rate limit error, we do not want to continue the scrape, we want to give it up now. Continuing
			// the scrape now will only make the rate limit error worse.
			if (e instanceof RateLimitError) {
				instagramRateLimitErrors.inc();
				break;
			}
		}
	}

	logger.info({ countsByOrganizer, opts }, 'Completed Instagram data ingestion');

	return countsByOrganizer;
}

export async function runScraperWithMetrics(source: UrlSource, scraper: UrlScraper): Promise<UrlEventInit[]> {
	const end = scrapeTime.labels(source.sourceType, source.sourceName).startTimer();
	scrapeStartCount.labels(source.sourceType, source.sourceName).inc();
	try {
		const events = await scraper.scrape(source);
		scrapeCompleteCount.labels(source.sourceType, source.sourceName, 'ok').inc();
		end();
		return events;
	} catch (e: any) {
		end();
		scrapeCompleteCount.labels(source.sourceType, source.sourceName, 'error').inc();
		throw e;
	}
}

export async function doUrlScrapes(opts?: UrlEventScrapeOptions) {
	logger.info({ opts }, 'Starting URL scrapes');

	let lastScraped;
	if (opts?.onlyUpdateStalerThan) {
		lastScraped = {
			lte: opts.onlyUpdateStalerThan.toJSDate(),
		};
	}

	let sources = await prisma.urlSource.findMany({
		where: {
			lastScraped,
			sourceType: {
				not: 'instagram',
			}
		}
	});

	const events = await Promise.all(sources.map(async source => {
		const events = await scrapeEventsFromSource(source);

		return await persistNewEvents(source, events);
	}));


	logger.info({ eventCount: events.flat().length, sourcesCount: sources.length }, 'Completed URL scrapes');
}

async function persistImages(source: UrlSource, event: UrlEvent, images?: UrlEventImageInit[]) {
	if (!images) {
		return;
	}

	await Promise.all(images.map(async ({ url, data }) => {
		try {
			if (!data) {
				const resp = await fetch(url);
				data = await resp.arrayBuffer();
			}

			await prisma.urlEventImage.create({
				data: {
					url,
					data: Buffer.from(data),
					eventID: event.id,
					contentType: '',
				}
			});
			imagesSaved.labels(source.sourceType, source.sourceName).inc()
		} catch (e: any) {
			logger.warn({ url, eror: e.toString() }, 'failed to fetch image');
		}
	}));
}

async function persistNewEvents(source: UrlSource, events: UrlEventInit[]): Promise<UrlEvent[]> {
	const createdEvents = await Promise.all(events.map(e => persistEvent(source, e)));

	const actualEvents: UrlEvent[] = [];
	createdEvents.forEach(e => {
		if (e) {
			actualEvents.push(e);
		}
	});

	eventsSaved.labels(source.sourceType, source.sourceName).inc(actualEvents.length);

	return actualEvents;
}

function computeHideAfter(source: UrlSource): Date | null {
	if (!source.unseenEventTTLSecs) {
		return null;
	}

	const ttl = Duration.fromObject({ seconds: source.unseenEventTTLSecs });

	return DateTime.now().plus(ttl).toJSDate();
}

// If a given event has already been scraped in the past, update it with new data from the most recent scrape
async function updatePersistedEvent(source: UrlSource, event: UrlEventInit) {
	const { images, description, location, ...restOfTheEvent } = event;

	const eventToUpdate = {
		...restOfTheEvent,
		lastSeen: new Date(),
		hideAfter: computeHideAfter(source),
		extendedProps: JSON.stringify({
			description,
			location,
		}),
	};

	await prisma.urlEvent.update({
		where: {
			url: event.url,
		},
		data: eventToUpdate,
	})
}

async function persistEvent(source: UrlSource, event: UrlEventInit): Promise<UrlEvent | undefined> {
	const { images, description, location, ...restOfTheEvent } = event;

	const eventToInsert = {
		...restOfTheEvent,
		sourceId: source.id,
		hideAfter: computeHideAfter(source),
		extendedProps: JSON.stringify({
			description,
			location,
		}),
	};

	logger.debug({ event }, 'inserting event into the database');

	try {
		const insertedEvent = await prisma.urlEvent.create({
			data: eventToInsert,
		});

		await persistImages(source, insertedEvent, images);

		return insertedEvent;
	} catch (e: any) {
		if (e instanceof Prisma.PrismaClientKnownRequestError) {
			// This is the response code for a unique constraint violation - IE "the post id was already in the DB"
			if (e.code === 'P2002') {
				// TODO: URLs are not guarunteed to be unique! Forbidden Tickets for example can have multiple events with the same
				// URL if it's a multi-part event. This function assumes they will be unique but this is not a safe assumption to make
				// :(
				logger.debug({ url: event.url }, 'skipping insertion on already-seen event');
				await updatePersistedEvent(source, event);
			}
		} else if (e instanceof Prisma.PrismaClientValidationError) {
			logger.warn({ url: event.url, error: e.toString(), stack: e.stack, sourceType: source.sourceType, source: source.sourceName, event: eventToInsert }, 'skipping insertion due to event not matching db schema, this may be a bug!');
		} else {
			logger.warn({ url: event.url, error: e.toString(), stack: e.stack, sourceType: source.sourceType, source: source.sourceName, event: eventToInsert }, 'Unknown error occurred inserting event');
		}

		return undefined;
	}
}

async function scrapeEventsFromSource(source: UrlSource): Promise<UrlEventInit[]> {
	const scraper = SCRAPER_MAP[source.sourceType];
	if (scraper) {
		try {
			const newEvents = await runScraperWithMetrics(source, scraper);

			await prisma.urlSource.update({
				where: {
					id: source.id,
				},
				data: {
					lastScraped: new Date(),
				}
			});

			return newEvents;
		} catch (e: any) {
			logger.error({ name: source.sourceName, type: source.sourceType, error: e.toString(), stack: e.stack }, `Error scraping`);
			return [];
		}
	}

	logger.error({ sourceType: source.sourceType }, 'Tried to scrape unknown source type, this is a bug!');

	return [];
}

export type Headers = {
	[key: string]: string
};

export async function fetchCachedWithHeaders(source: UrlSource, url: string | URL, headers: Headers, actOnResponse: (_: Response) => Promise<UrlEventInit[]>): Promise<UrlEventInit[]> {
	let innerHeaders: Headers = { ...headers };
	if (source.etagLastScrape) {
		innerHeaders['If-None-Match'] = source.etagLastScrape;
	}

	const response = await fetch(url, {
		headers: innerHeaders,
	});

	if (response.status === 304) {
		logger.debug({ name: source.sourceName, type: source.sourceType, url }, 'Skipping scrape due to server cache reporting no changes');
		return [];
	}

	if (!response.ok) {
		logger.error({ name: source.sourceName, type: source.sourceType, url, status: response.status, text: await response.text() }, `Error fetching url`);
		throw new Error(`Error fetching ${source.sourceName} - ${url}: ${response.status} ${response.statusText}`);
	}

	const value = await actOnResponse(response);

	const etag = response.headers.get('ETag');
	if (etag) {
		// TODO: probably this should not be persisted until the scrape has _successfully_ completed
		await prisma.urlSource.update({
			where: { id: source.id },
			data: {
				etagLastScrape: etag,
			}
		});
	}

	return value;
}

// Runs a fetch request against the given URL, using the stored eTag value from the DB as a `if-none-match` header.
// Returns null and does not call the provided callback if the server responds with a 304 not modified. Otherwise calls
// the provided callback and updates the etag in the db, returning whatever value was returned from the provided
// callback.
export async function fetchCached(source: UrlSource, url: string | URL, actOnResponse: (_: Response) => Promise<UrlEventInit[]>): Promise<UrlEventInit[]> {
	return fetchCachedWithHeaders(source, url, {}, actOnResponse)
}
