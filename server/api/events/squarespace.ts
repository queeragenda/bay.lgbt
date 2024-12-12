import eventSourcesJSON from 'public/event_sources.json';
import { serverCacheMaxAgeSeconds, serverStaleWhileInvalidateSeconds, serverFetchHeaders } from '~~/utils/util';
import { DateTime } from 'luxon';
import { logger as mainLogger } from '../../utils/logger';

const logger = mainLogger.child({ provider: 'squarespace' });

export default defineCachedEventHandler(async (event) => {
	const body = await fetchSquarespaceEvents();
	return {
		body
	}
}, {
	maxAge: serverCacheMaxAgeSeconds,
	staleMaxAge: serverStaleWhileInvalidateSeconds,
	swr: true,
});

async function fetchSquarespaceEvents() {
	let squarespaceSources = await useStorage().getItem('squarespaceSources');
	try {
		squarespaceSources = await Promise.all(
			eventSourcesJSON.squarespace.map(async (source) => {
				// Add current date in milliseconds to the URL to get events starting from this moment.
				const response = await fetch(source.url, { headers: serverFetchHeaders });
				if (!response.ok) {
          logger.error({ url: source.url, response }, 'Could not fetch events');
					return {
						events: [],
						city: source.city,
					} as EventNormalSource;
				}
				const squarespaceJson = await response.json();
				const squarespaceEvents = squarespaceJson.upcoming || squarespaceJson.items;
				return {
					events: squarespaceEvents.map(event => convertSquarespaceEventToFullCalendarEvent(squarespaceJson.website.timeZone, event, source.url, source.name)),
					city: source.city
				} as EventNormalSource;
			})
		);
		await useStorage().setItem('squarespaceSources', squarespaceSources);
	} catch (error) {
    logger.error({ error }, 'Error fetching Squarespace events');
	}
	return squarespaceSources;
};

function convertSquarespaceEventToFullCalendarEvent(timeZone: string, e, url, sourceName) {
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
		extendedProps: {
			description: e.body,
			image: e.assetUrl,
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
			raw: e
		}
	};
}
