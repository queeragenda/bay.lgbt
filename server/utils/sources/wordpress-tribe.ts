import { logger as mainLogger } from '~~/server/utils/logger';
import { UrlSource } from '@prisma/client';
import { SourceFile, UrlEventInit, UrlScraper, UrlSourceInit } from '../http';
import { Duration } from 'luxon';
import { parseUnseenEventTtl } from '../event-ttl';

const logger = mainLogger.child({ provider: 'wordpress-tribe' });

export class WordpressTribeScraper implements UrlScraper {
	name = 'wordpress-tribe';

	async scrape(source: UrlSource): Promise<UrlEventInit[]> {
		return fetchCached(source, source.url, async response => {
			let wpJson = await response.json();
			let wpEvents = wpJson.events;

			while (Object.hasOwn(wpJson, 'next_rest_url')) {
				let next_page_url = wpJson.next_rest_url;
				wpJson = await (await fetch(next_page_url)).json();
				wpEvents = wpEvents.concat(wpJson.events);
			}

			return wpEvents.map(convertWordpressTribeEventToFullCalendarEvent);
		});
	}

	generateSources(sources: SourceFile): UrlSourceInit[] {
		return sources.wordPressTribe.map(source => ({
			url: source.url,
			sourceName: source.name,
			sourceCity: source.city,
			unseenEventTTL: parseUnseenEventTtl(source),
		}))
	}
}

// The following conversion function is basically ripped from anarchism.nyc.
function convertWordpressTribeEventToFullCalendarEvent(e: any): UrlEventInit {
	return {
		title: e.title,
		start: new Date(e.utc_start_date + 'Z'),
		end: new Date(e.utc_end_date + 'Z'),
		url: e.url,
		description: e.description,
		images: [{ url: e.image.url }],
		location: {
			geoJSON: geoJson(e.venue.geo_lng, e.venue.geo_lat),
			eventVenue: {
				name: e.venue.venue,
				address: {
					streetAddress: e.venue.address,
					addressLocality: e.venue.city,
					postalCode: e.venue.zip,
					addressCountry: e.venue.country
				},
				geo: {
					latitude: e.venue.geo_lat,
					longitude: e.venue.geo_lng
				}
			}
		}
	};
}
