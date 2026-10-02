import { logger as mainLogger } from '~~/server/utils/logger';
import { UrlSource } from '@prisma/client';
import { DateTime } from 'luxon';
import { SourceFile, UrlEventInit, UrlScraper, UrlSourceInit } from '../http';
import { parseUnseenEventTtl } from '../event-ttl';

const logger = mainLogger.child({ provider: 'fullcalendar-json' });

// Date-only and offset-less times in a feed are interpreted in the Bay Area's timezone.
const DEFAULT_ZONE = 'America/Los_Angeles';

// Scrapes a static JSON feed in FullCalendar's event-source format: a top-level array of Event Objects.
// See https://fullcalendar.io/docs/event-source and https://fullcalendar.io/docs/event-object
export class FullCalendarJsonScraper implements UrlScraper {
	name = 'fullcalendar-json';

	async scrape(source: UrlSource): Promise<UrlEventInit[]> {
		return fetchCached(source, source.url, async response => {
			const items = await response.json();
			if (!Array.isArray(items)) {
				throw new Error(`Expected a JSON array of events from ${source.url}`);
			}

			// This app keys events by URL, but FullCalendar feeds often give several events the same `url` (or none),
			// e.g. every session of a recurring series. Give those events a unique URL using their `id`.
			const urlCounts = new Map<string, number>();
			items.forEach((item: any) => {
				if (item.url) {
					urlCounts.set(item.url, (urlCounts.get(item.url) || 0) + 1);
				}
			});

			const events: UrlEventInit[] = [];
			items.forEach((item: any, index: number) => {
				const event = convertFullCalendarEvent(item, index, source, urlCounts);
				if (event) {
					events.push(event);
				}
			});
			return events;
		});
	}

	generateSources(sources: SourceFile): UrlSourceInit[] {
		return sources.fullCalendarJson.map(source => ({
			url: source.url,
			sourceName: source.name,
			sourceCity: source.city,
			unseenEventTTL: parseUnseenEventTtl(source),
		}));
	}
}

function parseDate(value: string, allDay: boolean): DateTime {
	const parsed = DateTime.fromISO(value, { zone: DEFAULT_ZONE, setZone: true });
	return allDay ? parsed.startOf('day') : parsed;
}

function convertFullCalendarEvent(item: any, index: number, source: UrlSource, urlCounts: Map<string, number>): UrlEventInit | undefined {
	if (!item.title || !item.start || typeof item.start !== 'string') {
		logger.warn({ source: source.sourceName, item }, 'skipping FullCalendar event without a title or string start');
		return;
	}

	// FullCalendar treats an event as all-day when `allDay` is true, or when it is unset and the start has no time.
	const allDay = item.allDay ?? !item.start.includes('T');
	const start = parseDate(item.start, allDay);
	if (!start.isValid) {
		logger.warn({ source: source.sourceName, item }, 'skipping FullCalendar event with an unparseable start');
		return;
	}

	// FullCalendar end dates are exclusive. With no end, default to the whole day for all-day events or one hour otherwise.
	let end = item.end ? parseDate(item.end, allDay) : null;
	if (!end || !end.isValid || end <= start) {
		end = allDay ? start.plus({ days: 1 }) : start.plus({ hours: 1 });
	}

	let url = item.url;
	if (!url || (urlCounts.get(url) || 0) > 1) {
		url = `${url || source.url}#${encodeURIComponent(item.id ?? `${start.toISODate()}-${index}`)}`;
	}

	// Non-standard properties may be nested under extendedProps or set at the top level of the event object.
	const props = { ...item, ...(item.extendedProps || {}) };

	return {
		title: item.title,
		start: start.toJSDate(),
		end: end.toJSDate(),
		url,
		description: props.description,
		location: props.location ? { eventVenue: { name: props.location } } : undefined,
	};
}
