import { JSDOM } from 'jsdom';
import { DateTime } from 'luxon';

import { logger as mainLogger } from '~~/server/utils/logger';
import { UrlSource } from '@prisma/client';
import { fetchCached, SourceFile, UrlEventInit, UrlScraper, UrlSourceInit } from '../http';

const logger = mainLogger.child({ provider: 'eventbrite' });


export class EventbriteScraper implements UrlScraper {
	name = 'eventbrite';

	async scrape(source: UrlSource) {
		return await fetchCached(source, source.url, async (response) => {
			const html = await response.text();
			// const dom = new JSDOM(html);
			// const eventsRaw = JSON.parse(dom.window.document.querySelectorAll('script[type="application/ld+json"]')[1].innerHTML)
			// 	.map(event => convertSchemaDotOrgEventToFullCalendarEvent(event, source.name));
			const dom = new JSDOM(html);
			const innerHtml = dom.window.document.querySelectorAll('script[type="application/ld+json"]')[1].innerHTML;
			const eventsJson = JSON.parse(innerHtml).itemListElement;

			logger.debug({ url: source.url, eventsJson }, 'Loaded eventsJson');

			if (!Array.isArray(eventsJson)) {
				logger.warn({ url: source.url, eventsJson }, 'Found event with invalid JSON on the page');
				return [];
			}

			const eventsFC = eventsJson.map((event: any) => convertSchemaDotOrgEventToFullCalendarEvent(event.item, source.sourceName));

			// Since public & private Eventbrite endpoints provides a series of events as a single event, we need to split them up using their API.
			const events = await Promise.all(eventsFC.map(async (rawEvent: any) => {
				const isLongerThan3Days = (rawEvent.end.getTime() - rawEvent.start.getTime()) / (1000 * 3600 * 24) > 3;
				if (isLongerThan3Days) {
					const eventSeries = await getEventSeries(rawEvent.url);
					return eventSeries.map((event: any) => convertEventbriteAPIEventToFullCalendarEvent(event, source.sourceName));
				} else {
					return rawEvent;
				}
			}));

			return events.flat();
		});
	}

	generateSources(sources: SourceFile) {
		if (process.env.EVENTBRITE_API_KEY === undefined) {
			throw new Error("No Eventbrite API key found. Please set the EVENTBRITE_API_KEY environment variable.");
		}

		return sources.eventbriteAccounts.map(source => ({
			url: source.url,
			sourceID: source.id,
			sourceName: source.name,
			sourceCity: source.city,
		}));
	}
}

// TODO: come up with a way for event promoters to submit events to us and have us store them in the DB without
// requiring code changes?
export class EventbriteSingleScraper implements UrlScraper {
	name = 'eventbrite-single';

	async scrape(source: UrlSource): Promise<UrlEventInit[]> {
		return await fetchCached(source, source.url, async (response) => {
			const body = await response.json();

			// Sometimes the response returns 404 for whatever reason. I imagine for events with information set to private. Ignore those.
			if (!body.events) {
				return [];
			}

			return body.events.map((event: any) => convertEventbriteAPIEventToFullCalendarEvent(event, source.sourceName));
		});
	}


	generateSources(sources: SourceFile): UrlSourceInit[] {
		if (process.env.EVENTBRITE_API_KEY === undefined) {
			throw new Error("No Eventbrite API key found. Please set the EVENTBRITE_API_KEY environment variable.");
		}

		return sources.eventbriteSingleEventSeries.map(source => ({
			url: source.url,
			sourceName: source.title,
			sourceCity: source.city,
		}));
	}
}

function eventSeriesUrl(url: string) {
	const series_id = url.split('-').pop();
	return `https://www.eventbriteapi.com/v3/series/${series_id}/events/?token=${process.env.EVENTBRITE_API_KEY}`;
}

async function getEventSeries(eventUrl: string) {
	// Split URL by '-' and get the last part.
	const res = await fetch(eventSeriesUrl(eventUrl));
	const body = await res.json();

	// Sometimes the response returns 404 for whatever reason. I imagine for events with information set to private. Ignore those.
	if (!body.events) {
		return [];
	}

	return body.events;
}

function convertSchemaDotOrgEventToFullCalendarEvent(item: any, sourceName: string) {
	// If we have a `geo` object, format it to geoJSON.
	var geoJSON = (item.location.geo) ? {
		type: "Point",
		coordinates: [
			item.location.geo.longitude,
			item.location.geo.latitude
		]
		// Otherwise, set it to null.
	} : null;

	return {
		title: `${item.name} @ ${sourceName}`,
		// Converts from System Time to UTC.
		start: DateTime.fromISO(item.startDate).toUTC().toJSDate(),
		end: DateTime.fromISO(item.endDate).toUTC().toJSDate(),
		url: item.url,
		extendedProps: {
			description: item.description || null,
			image: item.image,
			location: {
				geoJSON: geoJSON,
				eventVenue: {
					name: item.location.name,
					address: {
						streetAddress: item.location.streetAddress,
						addressLocality: item.location.addressLocality,
						addressRegion: item.location.addressRegion,
						postalCode: item.location.postalCode,
						addressCountry: item.location.addressCountry
					},
					geo: item.location?.geo
				}
			}
		}
	};
};

// The problem with the Eventbrite developer API format is that it lacks geolocation.
function convertEventbriteAPIEventToFullCalendarEvent(item: any, sourceName: string) {
	try {
		return {
			title: `${item.name.text} @ ${sourceName}`,
			start: new Date(item.start.utc),
			end: new Date(item.end.utc),
			url: item.url,
		};
	} catch (e) {
		console.log(item);
		throw e;
	}
};
