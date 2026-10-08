import { logger as mainLogger } from '~~/server/utils/logger';
import { UrlSource } from '@prisma/client';
import { DateTime } from 'luxon';
import ICAL from 'ical.js';
import { SourceFile, UrlEventInit, UrlScraper, UrlSourceInit } from '../http';
import { parseUnseenEventTtl } from '../event-ttl';

const logger = mainLogger.child({ provider: 'ical' });

// Date-only values, floating times, and TZIDs that aren't IANA names are read in the Bay Area's timezone.
const DEFAULT_ZONE = 'America/Los_Angeles';

// Safety cap on occurrences expanded from a single recurring event.
const MAX_OCCURRENCES = 1000;

// Scrapes an iCalendar (.ics / webcal) feed, expanding recurring events into individual occurrences.
export class IcalScraper implements UrlScraper {
	name = 'ical';

	async scrape(source: UrlSource): Promise<UrlEventInit[]> {
		return fetchCached(source, source.url, async response => {
			return parseIcal(await response.text(), source);
		});
	}

	generateSources(sources: SourceFile): UrlSourceInit[] {
		return sources.ical.map(source => ({
			// webcal:// is just https:// for calendar apps
			url: source.url.replace(/^webcal:\/\//, 'https://'),
			sourceName: source.name,
			sourceCity: source.city,
			unseenEventTTL: parseUnseenEventTtl(source),
		}));
	}
}

interface Occurrence {
	event: ICAL.Event
	start: DateTime
	end: DateTime
	recurring: boolean
}

export function parseIcal(text: string, source: { url: string, sourceName: string }, now: Date = new Date()): UrlEventInit[] {
	const calendar = new ICAL.Component(ICAL.parse(text));

	// Same window as the Google Calendar scraper: two months back, one year ahead.
	const windowStart = DateTime.fromJSDate(now).minus({ months: 2 });
	const windowEnd = DateTime.fromJSDate(now).plus({ years: 1 });

	// Group overridden occurrences (RECURRENCE-ID) with the event they modify. These share the original event's UID.
	const masters = new Map<string, ICAL.Event>();
	const exceptions: ICAL.Event[] = [];
	for (const vevent of calendar.getAllSubcomponents('vevent')) {
		const event = new ICAL.Event(vevent);
		if (event.isRecurrenceException()) {
			exceptions.push(event);
		} else {
			masters.set(event.uid, event);
		}
	}
	for (const exception of exceptions) {
		const master = masters.get(exception.uid);
		if (master) {
			master.relateException(exception);
		} else {
			masters.set(`${exception.uid}#${exception.recurrenceId.toString()}`, exception);
		}
	}

	const occurrences: Occurrence[] = [];
	for (const event of masters.values()) {
		const tzid = stringParam(event.component.getFirstProperty('dtstart')?.getParameter('tzid'));

		if (!event.isRecurring()) {
			const start = toDateTime(event.startDate, tzid);
			const end = event.endDate ? toDateTime(event.endDate, tzid) : null;
			occurrences.push({ event, start, end: fixEnd(start, end, event.startDate.isDate), recurring: false });
			continue;
		}

		const iterator = event.iterator();
		let next: ICAL.Time | null;
		for (let i = 0; i < MAX_OCCURRENCES && (next = iterator.next()); i++) {
			const start = toDateTime(next, tzid);
			if (start > windowEnd) {
				break;
			}

			const details = event.getOccurrenceDetails(next);
			const end = toDateTime(details.endDate, tzid);
			occurrences.push({ event: details.item, start: toDateTime(details.startDate, tzid), end: fixEnd(start, end, next.isDate), recurring: true });
		}
	}

	// This app keys events by URL. A UID is unique per event, but every occurrence of a recurring event shares its
	// UID and URL, and many feeds share one URL across events or omit it, so those get a unique fragment below.
	const linkCounts = new Map<string, number>();
	const links = new Map<ICAL.Event, string | undefined>();
	for (const { event } of occurrences) {
		if (!links.has(event)) {
			const link = eventLink(event);
			links.set(event, link);
			if (link) {
				linkCounts.set(link, (linkCounts.get(link) || 0) + 1);
			}
		}
	}

	const events: UrlEventInit[] = [];
	for (const { event, start, end, recurring } of occurrences) {
		if (!start.isValid || end < windowStart || start > windowEnd) {
			continue;
		}
		if (String(event.component.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED') {
			continue;
		}
		if (!event.summary) {
			logger.warn({ source: source.sourceName, uid: event.uid }, 'skipping iCal event without a SUMMARY');
			continue;
		}

		let url = links.get(event);
		if (!url || recurring || (linkCounts.get(url) || 0) > 1) {
			const id = recurring ? `${event.uid}-${start.toFormat('yyyyLLdd')}` : event.uid;
			url = withFragment(url || source.url, id);
		}

		events.push({
			title: event.summary,
			start: start.toJSDate(),
			end: end.toJSDate(),
			url,
			description: event.description || undefined,
			location: event.location ? { eventVenue: { name: event.location } } : undefined,
			images: eventImages(event),
		});
	}

	return events;
}

// The event's URL property, or failing that the first link in its description.
function eventLink(event: ICAL.Event): string | undefined {
	const url = event.component.getFirstPropertyValue('url');
	if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
		return url;
	}
	const match = event.description?.match(/https?:\/\/[^\s<>"']+/i);
	return match ? match[0].replace(/[).,;:!?\]]+$/, '') : undefined;
}

// Image URLs from RFC 7986 IMAGE properties, then ATTACH properties that point at an image. Inline (base64) data
// is skipped.
function eventImages(event: ICAL.Event): { url: string }[] | undefined {
	const urls = new Set<string>();
	for (const name of ['image', 'attach']) {
		for (const prop of event.component.getAllProperties(name)) {
			const value = prop.getFirstValue();
			const type = stringParam(prop.getParameter('fmttype'));
			if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || prop.getParameter('encoding')) {
				continue;
			}
			if (name === 'image' || type?.startsWith('image/') || (!type && /\.(jpe?g|png|gif|webp)(\?|$)/i.test(value))) {
				urls.add(value);
			}
		}
	}
	return urls.size ? [...urls].map(url => ({ url })) : undefined;
}

// Adds an identifier to a URL's fragment, keeping any fragment it already has, so the result stays a valid URL.
function withFragment(url: string, id: string): string {
	try {
		const parsed = new URL(url);
		const existing = parsed.hash.replace(/^#/, '');
		parsed.hash = existing ? `${existing}-${id}` : id;
		return parsed.toString();
	} catch {
		return `${url.split('#')[0]}#${encodeURIComponent(id)}`;
	}
}

function stringParam(value: string | string[] | undefined | null): string | undefined {
	return Array.isArray(value) ? value[0] : value || undefined;
}

// Converts an ICAL.Time to a DateTime without relying on VTIMEZONE registration: UTC stays UTC, date-only values
// and floating times use the event's TZID when it's an IANA name, otherwise DEFAULT_ZONE.
function toDateTime(time: ICAL.Time, tzid?: string): DateTime {
	if (time.isDate) {
		return DateTime.fromObject({ year: time.year, month: time.month, day: time.day }, { zone: DEFAULT_ZONE });
	}
	const parts = { year: time.year, month: time.month, day: time.day, hour: time.hour, minute: time.minute, second: time.second };
	if (time.zone === ICAL.Timezone.utcTimezone) {
		return DateTime.fromObject(parts, { zone: 'utc' });
	}
	const zone = tzid && DateTime.now().setZone(tzid).isValid ? tzid : DEFAULT_ZONE;
	return DateTime.fromObject(parts, { zone });
}

// iCal end times are exclusive. Without a usable end, default to one day for all-day events and one hour otherwise.
function fixEnd(start: DateTime, end: DateTime | null, allDay: boolean): DateTime {
	if (end && end.isValid && end > start) {
		return end;
	}
	return allDay ? start.plus({ days: 1 }) : start.plus({ hours: 1 });
}
