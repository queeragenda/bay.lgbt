import eventSourcesJSON from 'public/event_sources.json';
import { serverCacheMaxAgeSeconds, serverStaleWhileInvalidateSeconds, serverFetchHeaders } from '~~/utils/util';
import { DateTime } from 'luxon';

import { logger as mainLogger } from '../../utils/logger';

const logger = mainLogger.child({ provider: 'forbidden-tickets' });

export default defineCachedEventHandler(async (event) => {
	const body = await fetchForbiddenTicketsEvents();
	return {
		body
	}
}, {
	maxAge: serverCacheMaxAgeSeconds,
	staleMaxAge: serverStaleWhileInvalidateSeconds,
	swr: true,
});

async function fetchForbiddenTicketsEvents() {
	let forbiddenTicketsSources = await useStorage().getItem('forbiddenTicketsSources');
	try {
		forbiddenTicketsSources = await Promise.all(
			eventSourcesJSON.forbiddenTickets.map(async (source) => {
				const fetchUrl = new URL(`https://forbiddentickets.com/events/${source.username}/json`);

				const response = await fetch(fetchUrl);
				if (!response.ok) {
					logger.error({ response: await response.text() }, 'Could not fetch events');
					return {
						events: [],
						city: source.city,
					};
				}

				const json = await response.json();

				const events = json.map((item) => {
					return {
						title: `${item.title}`,
						url: item.url,
						start: DateTime.fromFormat(item.start, 'yyyy-MM-dd HH:mm:ss', { zone: 'UTC' }),
						end: DateTime.fromFormat(item.end, 'yyyy-MM-dd HH:mm:ss', { zone: 'UTC' }),
					}
				});

				logger.debug({ events }, 'Fetched events');

				return {
					events,
					city: source.city
				};
			})
		);
		await useStorage().setItem('forbiddenTicketsSources', forbiddenTicketsSources);
	} catch (error) {
		logger.error({ error: error.toString() }, 'Failed to fetch events');
	}
	return forbiddenTicketsSources;
};
