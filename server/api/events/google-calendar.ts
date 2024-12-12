import eventSourcesJSON from 'public/event_sources.json';
import { serverCacheMaxAgeSeconds, serverStaleWhileInvalidateSeconds, serverFetchHeaders } from '~~/utils/util';
import { logger as mainLogger } from '../../utils/logger';

const logger = mainLogger.child({ provider: 'google-calendar' });

export default defineCachedEventHandler(async (event) => {
	const body = await fetchGoogleCalendarEvents();
	return {
		body
	}
}, {
	maxAge: serverCacheMaxAgeSeconds,
	staleMaxAge: serverStaleWhileInvalidateSeconds,
	swr: true,
});

async function fetchGoogleCalendarEvents() {
	let googleCalendarSources = await useStorage().getItem('googleCalendarSources');
	try {
		if (!process.env.GOOGLE_CALENDAR_API_KEY) {
			throw new Error('No Google Calendar API key found. Please set the GOOGLE_CALENDAR_API_KEY environment variable.');
		}

		googleCalendarSources = await Promise.all(
			eventSourcesJSON.googleCalendar.map(async (source) => {

				const searchParams = new URLSearchParams({
					singleEvents: true,
					maxResults: 9999,
					timeMin: new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString(),
					timeMax: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
				});

				const res = await fetch(
					`https://www.googleapis.com/calendar/v3/calendars/${source.googleCalendarId}/events?key=${process.env.GOOGLE_CALENDAR_API_KEY}`
					+ `&${searchParams.toString()}`,
					{ headers: serverFetchHeaders }
				);
				// Error check.
				if (!res.ok) {
					throw new Error(`Error fetching Google Calendar events for ${source.name}: ${res.status} ${res.statusText}`);
				}
				const data = await res.json()

				const events = await Promise.all(data.items.map(async (item) => {
					const event = {
						title: `${item.summary} @ ${source.name}`,
						start: item.start.dateTime,
						end: item.end.dateTime,
						url: item.htmlLink,
					};
					return event;
				}));

				return {
					events,
					city: source.city
				};
			}
			));
		await useStorage().setItem('googleCalendarSources', googleCalendarSources);
	}
	catch (error) {
    logger.error({ error }, "Failed to fetch events");
	}
	return googleCalendarSources;
}
