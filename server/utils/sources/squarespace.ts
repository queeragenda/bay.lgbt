import { DateTime } from 'luxon';
import { logger as mainLogger } from '~~/server/utils/logger';
import { UrlSource } from '@prisma/client';
import { fetchCached, SourceFile, UrlEventInit, UrlScraper, UrlSourceInit } from '../http';

const logger = mainLogger.child({ provider: 'squarespace' });

export class SquarespaceScraper implements UrlScraper {
	name = 'squarespace';

	async scrape(source: UrlSource): Promise<UrlEventInit[]> {
		return fetchCached(source, source.url, async response => {
			const squarespaceJson = await response.json();
			const events = squarespaceJson.upcoming || squarespaceJson.items;

			if (!Array.isArray(events)) {
				logger.warn({ events, sourceName: source.sourceName, url: source.url }, 'Got invalid JSON for events');
				return [];
			}

			return events.map((event: any) => convertSquarespaceEventToFullCalendarEvent(squarespaceJson.website.timeZone, event, source.url, source.sourceName));
		});
	}

	generateSources(sources: SourceFile): UrlSourceInit[] {
		return sources.squarespace.map(source => ({
			url: source.url,
			sourceName: source.name,
			sourceCity: source.city,
		}));
	}
}

function convertSquarespaceEventToFullCalendarEvent(timeZone: string, e: any, url: string, sourceName: string): UrlEventInit {
	let start = DateTime.fromMillis(e.startDate).setZone(timeZone);
	let end = DateTime.fromMillis(e.startDate).setZone(timeZone);

	// Get raw times because some calendars have incorrect time zones (i.e. America/New_York), even though they're in California.
	const actualStart = DateTime.fromObject({
		day: start.day,
		month: start.month,
		year: start.year,
		hour: start.hour,
		minute: start.minute,
	}, { zone: 'America/Los_Angeles' });
	const actualEnd = DateTime.fromObject({
		day: end.day,
		month: end.month,
		year: end.year,
		hour: end.hour,
		minute: end.minute,
	}, { zone: 'America/Los_Angeles' });

	return {
		title: `${e.title} @ ${sourceName}`,
		start: actualStart.toUTC().toJSDate(),
		end: actualEnd.toUTC().toJSDate(),
		url: new URL(url).origin + e.fullUrl,
		description: e.body,
		images: [{ url: e.assetUrl }],
		location: {
			geoJSON: {
				type: "Point",
				coordinates: [e.location.mapLng, e.location.mapLat]
			},
			eventVenue: {
				name: e.location.addressTitle,
				address: {
					streetAddress: e.location.addressLine1,
					// TODO: Some of these are not provided.
					//                        addressLocality: e.location.addressLine2.split(',')[0].trim(),
					//                        addressRegion: e.location.addressLine2.split(',')[1].trim(),
					//                        postalCode: e.location.addressLine2.split(',')[2].trim(),
					addressCountry: e.location.addressCountry
				},
				geo: {
					latitude: e.location.mapLat,
					longitude: e.location.mapLng,
				}
			},
		},
	};
}
