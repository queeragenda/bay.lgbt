import { DateTime } from 'luxon';
import { logger as mainLogger } from '~~/server/utils/logger';
import { UrlEvent, UrlSource } from '@prisma/client';
import { fetchCachedWithHeaders, SourceFile, UrlEventInit, UrlScraper, UrlSourceInit } from '../http';

const logger = mainLogger.child({ provider: 'timely' });

export class TimelyScraper implements UrlScraper {
	name = 'timely';

	async scrape(source: UrlSource) {
		// startUtc is 1 month before today in Unix epoch time.
		const startUtc = Math.floor(new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).getTime() / 1000);
		// endUtc is 1 month after today in Unix epoch time.
		const endUtc = Math.floor(new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).getTime() / 1000);
		const fetchUrl = `${source.url}?group_by_date=1&start_date_utc=${startUtc}&end_date_utc=${endUtc}&per_page=600&page=1/`;

		const headers = {
			// This seems to be hard-set by Timely? Needs further testing.
			'x-api-key': 'c6e5e0363b5925b28552de8805464c66f25ba0ce',
		};

		return fetchCachedWithHeaders(source, fetchUrl, headers, async response => {
			const json = await response.json();
			// Convert to map because Timely returns an object with keys being dates, with data as values.
			const map = new Map(Object.entries(json.data.items));

			return [...map.values()].map((item: any) => {
				item = item[0];
				const timeZone = item.timezone;
				return {
					title: `${item.title} @ ${source.sourceName}`,
					url: item.url,
					start: DateTime.fromFormat(item.start_datetime, 'yyyy-MM-dd HH:mm:ss', { zone: timeZone }).toJSDate(),
					end: DateTime.fromFormat(item.end_datetime, 'yyyy-MM-dd HH:mm:ss', { zone: timeZone }).toJSDate(),
				}
			});
		});
	}

	generateSources(sources: SourceFile): UrlSourceInit[] {
		return sources.timely.map(source => ({
			sourceName: source.name,
			sourceCity: source.city,
			// Can get the calendarId from inspecting the Calendar's request URL in the Browser's Network inspector.
			sourceID: source.calendarId,
			url: `https://timelyapp.time.ly/api/calendars/${source.calendarId}/events`,
		}));
	}
}
