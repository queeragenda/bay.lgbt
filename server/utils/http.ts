import { UrlSource } from "@prisma/client";
import { DateTime } from "luxon";
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
];
// This horribly ugly line turns the array of scrapers above into a map of scraper names to scraper instances
const SCRAPER_MAP: { [name: string]: UrlScraper } = Object.assign({}, ...SCRAPERS.map(s => ({ [s.name]: s })));

export type SourceFile = typeof eventSourcesJSON;
export interface UrlSourceInit {
	url: string
	sourceName: string
	sourceCity: string
	sourceID?: string
}

export interface UrlEventInit {
	url: string
	title: string
	start: Date
	end: Date

	// These fields below will not actually get saved into the database
	description?: string
	location?: EventLocation
	imageUrls?: [string]
}

interface JustScrapedEvent extends UrlEventInit {
	sourceId: number
}

export interface UrlScraper {
	name: string

	scrape(source: UrlSource): Promise<UrlEventInit[]>
	generateSources(sources: SourceFile): UrlSourceInit[]
}

export interface ScrapeOptions {
	// Will only run the scrape for organizers that have not been updated since before the given time
	onlyUpdateStalerThan?: DateTime,
}

export async function initializeAllScrapers() {
	await Promise.all(SCRAPERS.map(async (scraper) => {
		const sourceInits = scraper.generateSources(eventSourcesJSON);

		await Promise.all(sourceInits.map(async sourceInit => {
			const source = await prisma.urlSource.findFirst({ where: { url: sourceInit.url }, select: { id: true } });
			if (source) {
				// TODO: update source properties, or refactor this fn to use upsert (requires changing ID column)
				return;
			}

			await prisma.urlSource.create({
				data: {
					url: sourceInit.url,
					sourceName: sourceInit.sourceName,
					sourceCity: sourceInit.sourceCity,
					sourceType: scraper.name,
					sourceID: sourceInit.sourceID,
					// If this field is not initialized to 0 (or at least an hour in the past), newly created sources will not be
					// scraped for the first hour of runtime, as the scrape job skips all sources that have been updated within
					// the past hour.
					lastScraped: new Date(0),
				}
			});
		}))
	}))
}

export async function doUrlScrapes(opts?: ScrapeOptions) {
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
		}
	});

	const events = await Promise.all(sources.map(async source => {
		const events = await scrapeEventsFromSource(source);

		return events.map(event => ({ ...event, sourceId: source.id }));
	}));

	const urlEvents = await persistNewEvents(events.flat());

	logger.info({ eventCount: urlEvents.count, sourcesCount: sources.length }, 'Completed URL scrapes');
}

async function persistNewEvents(events: JustScrapedEvent[]) {
	// TODO: URLs are not guarunteed to be unique! Forbidden Tickets for example can have multiple events with the same
	// URL if it's a multi-part event. This function assumes they will be unique but this is not a safe assumption to make
	// :(
	const existingUrls = await prisma.urlEvent.findMany({
		where: {
			url: { in: events.map(e => e.url) },
		},
		select: { url: true },
	});

	const existingUrlsSet = new Set<string>();
	for (let url of existingUrls) {
		existingUrlsSet.add(url.url);
	}

	const eventsToInsert = events.filter(e => {
		if (existingUrlsSet.has(e.url)) {
			return false;
		}
		existingUrlsSet.add(e.url);
		return true;
	}).map(e => {
		const { imageUrls, description, location, ...restOfTheEvent } = e;
		// TODO: store images

		return {
			...restOfTheEvent,
			extendedProps: JSON.stringify({
				description,
				location,
				images: imageUrls,
			}),
		};
	});

	const newEvents = await prisma.urlEvent.createMany({
		data: eventsToInsert,
	});

	return newEvents;
}

async function scrapeEventsFromSource(source: UrlSource): Promise<UrlEventInit[]> {
	const scraper = SCRAPER_MAP[source.sourceType];
	if (scraper) {
		try {
			const newEvents = await scraper.scrape(source);

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
