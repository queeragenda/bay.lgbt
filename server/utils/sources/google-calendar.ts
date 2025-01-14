import { logger as mainLogger } from '~~/server/utils/logger';
import { UrlEvent, UrlSource } from '@prisma/client';
import { UrlScraper, UrlSourceInit, SourceFile, fetchCached, UrlEventInit } from '../http';

const logger = mainLogger.child({ provider: 'google-calendar' });

export class GcalScraper implements UrlScraper {
	name = 'google-calendar';

	async scrape(source: UrlSource) {
		const searchParams = new URLSearchParams({
			singleEvents: 'true',
			maxResults: '9999',
			timeMin: new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString(),
			timeMax: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
			key: process.env.GOOGLE_CALENDAR_API_KEY || '',
		});

		const url = `${source.url}?${searchParams.toString()}`;

		return fetchCached(source, url, async response => {
			const data = await response.json()

			return data.items.map((item: any): UrlEventInit => ({
				title: `${item.summary} @ ${source.sourceName}`,
				start: item.start.dateTime,
				end: item.end.dateTime,
				url: item.htmlLink,
				description: item.description,
				location: {
					eventVenue: {
						name: item.location,
					},
				},
			}));
		});
	}

	generateSources(sources: SourceFile): UrlSourceInit[] {
		if (!process.env.GOOGLE_CALENDAR_API_KEY) {
			throw new Error('No Google Calendar API key found. Please set the GOOGLE_CALENDAR_API_KEY environment variable.');
		}

		return sources.googleCalendar.map(source => ({
			url: `https://www.googleapis.com/calendar/v3/calendars/${source.googleCalendarId}/events`,
			sourceName: source.name,
			sourceID: source.googleCalendarId,
			sourceCity: source.city,
		}));
	}
}
