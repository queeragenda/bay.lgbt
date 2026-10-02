import { logger as mainLogger } from '~~/server/utils/logger';
import { UrlSource } from '@prisma/client';
import { fetchCached, fetchCachedWithHeaders, SourceFile, UrlEventInit, UrlScraper, UrlSourceInit } from '../http';
import { geoJson } from '../geo';

const logger = mainLogger.child({ provider: 'eventbrite' });

const API_BASE = 'https://www.eventbriteapi.com/v3';

// Safety cap on pages fetched per organizer (the API returns up to 50 events per page).
const MAX_PAGES = 10;

function authHeaders() {
	return { Authorization: `Bearer ${process.env.EVENTBRITE_API_KEY}` };
}

// Eventbrite organizer pages used to embed every upcoming event as Schema.org JSON-LD, but that was removed around
// June 2026 (see #31). This uses the documented organizer events endpoint instead, which returns an organizer's
// upcoming public events (each occurrence of a series as its own event) with venue details and coordinates.
export class EventbriteScraper implements UrlScraper {
	name = 'eventbrite';

	async scrape(source: UrlSource) {
		const url = organizerEventsUrl(source.sourceID!);

		return await fetchCachedWithHeaders(source, url, authHeaders(), async (response) => {
			let body = await response.json();
			const events: any[] = body.events || [];

			for (let page = 1; body.pagination?.has_more_items && page < MAX_PAGES; page++) {
				const res = await fetch(organizerEventsUrl(source.sourceID!, body.pagination.continuation), { headers: authHeaders() });
				if (!res.ok) {
					logger.warn({ name: source.sourceName, status: res.status }, 'Error fetching next page of Eventbrite events');
					break;
				}
				body = await res.json();
				events.push(...(body.events || []));
			}

			logger.debug({ name: source.sourceName, count: events.length }, 'Loaded Eventbrite events');

			return events
				.filter(event => !event.is_series_parent)
				.map(event => convertEventbriteAPIEventToFullCalendarEvent(event, source.sourceName));
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

function organizerEventsUrl(organizerId: string, continuation?: string) {
	const params = new URLSearchParams({ status: 'live', order_by: 'start_asc', expand: 'venue' });
	if (continuation) {
		params.set('continuation', continuation);
	}
	return `${API_BASE}/organizers/${organizerId}/events/?${params}`;
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

// Converts an event from the Eventbrite API, expanded with `venue`, into our event format.
function convertEventbriteAPIEventToFullCalendarEvent(item: any, sourceName: string): UrlEventInit {
	const venue = item.venue;
	const address = venue?.address;
	const image = item.logo?.original?.url || item.logo?.url;

	return {
		title: item.name.text,
		start: new Date(item.start.utc),
		end: new Date(item.end.utc),
		url: item.url,
		description: item.description?.html || item.summary || undefined,
		images: image ? [{ url: image }] : undefined,
		location: venue ? {
			geoJSON: geoJson(Number(venue.longitude), Number(venue.latitude)),
			eventVenue: {
				name: venue.name,
				address: {
					streetAddress: [address?.address_1, address?.address_2].filter(Boolean).join(', ') || undefined,
					addressLocality: address?.city,
					addressRegion: address?.region,
					postalCode: address?.postal_code,
					addressCountry: address?.country,
				},
				geo: venue.latitude && venue.longitude ? {
					latitude: Number(venue.latitude),
					longitude: Number(venue.longitude),
				} : undefined,
			},
		} : undefined,
	};
}
