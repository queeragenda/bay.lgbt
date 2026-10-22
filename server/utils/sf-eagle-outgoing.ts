import { JSDOM } from 'jsdom';

export const SF_EAGLE_API = 'https://wp.sf-eagle.com/wp-json/tribe/events/v1/events?per_page=50';
const INDEX = 'https://sf-eagle.com/events/';
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 4000;

type Source = { sourceType: string; url: string };
type Occurrence = { url: string; start: Date; end: Date };

export function isSfEagleSource(source: Source): boolean {
	return source.sourceType === 'wordpress-tribe' && source.url === SF_EAGLE_API;
}

// The venue has no reliable permalink rule. Only follow a currently indexed,
// API-ID-suffixed page whose structured dates identify this exact occurrence.
// Keep the database URL (also the scraper's unique identity) unchanged.
export async function sfEagleOutgoingUrl(event: Occurrence, source: Source, fetchPage: typeof fetch = fetch): Promise<string> {
	if (!isSfEagleSource(source)) return event.url;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const read = async (url: string): Promise<string> => {
			const response = await fetchPage(url, { redirect: 'manual', cache: 'no-store', signal: controller.signal });
			if (response.status !== 200 || response.redirected || response.url !== url || !response.body) throw new Error('Unexpected venue response');
			const reader = response.body.getReader();
			const chunks: Uint8Array[] = [];
			let size = 0;
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					size += value.byteLength;
					if (size > MAX_BYTES) throw new Error('Venue response too large');
					chunks.push(value);
				}
			} finally {
				await reader.cancel();
			}
			return Buffer.concat(chunks).toString('utf8');
		};

		const api = JSON.parse(await read(SF_EAGLE_API));
		if (!Array.isArray(api.events)) return event.url;
		const matches = api.events.filter((item: any) => item.url === event.url);
		if (matches.length !== 1) return event.url;
		const match = matches[0];
		if (!Number.isSafeInteger(match.id) || match.id <= 0 || match.status !== 'publish'
			|| api.events.filter((item: any) => item.id === match.id).length !== 1
			|| apiTime(match.utc_start_date) !== event.start.getTime()
			|| apiTime(match.utc_end_date) !== event.end.getTime()) return event.url;

		const index = new JSDOM(await read(INDEX));
		let candidates: string[];
		try {
			candidates = [...new Set(Array.from(index.window.document.querySelectorAll('a[href]'))
				.map(a => new URL(a.getAttribute('href')!, INDEX).href)
				.filter(href => /^https:\/\/sf-eagle\.com\/events\/[a-z0-9-]+\/$/.test(href) && href.endsWith(`-${match.id}/`)))];
		} finally {
			index.window.close();
		}
		if (candidates.length !== 1) return event.url;
		const destination = candidates[0];
		const detail = new JSDOM(await read(destination));
		try {
			const canonicals = detail.window.document.querySelectorAll('link[rel="canonical"]');
			if (canonicals.length !== 1 || canonicals[0].getAttribute('href') !== destination) return event.url;
			const events: any[] = [];
			const collect = (value: any, depth = 0): void => {
				if (depth > 6) throw new Error('Nested venue data');
				if (Array.isArray(value)) value.forEach(item => collect(item, depth + 1));
				else if (value && typeof value === 'object') {
					if (value['@type'] === 'Event') events.push(value);
					if (value['@graph']) collect(value['@graph'], depth + 1);
				}
			};
			for (const script of detail.window.document.querySelectorAll('script[type="application/ld+json"]')) {
				collect(JSON.parse(script.textContent || ''));
			}
			if (events.length !== 1) return event.url;
			const occurrence = events[0];
			return occurrence.url === destination
				&& schemaTime(occurrence.startDate) === event.start.getTime()
				&& schemaTime(occurrence.endDate) === event.end.getTime()
				? destination : event.url;
		} finally {
			detail.window.close();
		}
	} catch {
		return event.url;
	} finally {
		clearTimeout(timer);
		controller.abort();
	}
}

function apiTime(value: unknown): number {
	if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)) return NaN;
	const iso = value.replace(' ', 'T');
	const time = Date.parse(iso + 'Z');
	// Date.parse silently normalizes e.g. February 30 and 24:00. Those are
	// malformed occurrence evidence, even if the resulting instant matches.
	return Number.isFinite(time) && new Date(time).toISOString().slice(0, 19) === iso ? time : NaN;
}

function schemaTime(value: unknown): number {
	return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)
		&& Number.isFinite(apiTime(value.slice(0, 19).replace('T', ' ')))
		? Date.parse(value) : NaN;
}
