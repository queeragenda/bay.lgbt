import { logger as mainLogger } from '~~/server/utils/logger';
import { CityEventListing } from '~~/types';
import { prisma } from '~~/server/utils/db';
import { getQuery } from 'h3';
import { urlEventToFullcalendar } from '~~/server/utils/event-api';
import { H3Event } from 'h3';
import { DateTime } from 'luxon';
import { EventInput } from '@fullcalendar/core';

const logger = mainLogger.child({ provider: 'url-events' });

export default defineEventHandler(async (event) => {
	try {
		const eventQuery = extractQuery(event);

		const events = await fetchEvents(eventQuery);

		return events;
	} catch (error: any) {
		logger.error({ error: error.toString(), stack: error.stack }, 'Failed to fetch events');
		throw createError({
			statusCode: 500,
			statusMessage: '' + error,
		});
	}
});

interface EventsQuery {
	organizerId?: number;
	cities?: string[];
	start?: DateTime;
	end?: DateTime;
	loadFullEvent: boolean;
}

function extractQuery(event: H3Event): EventsQuery {
	const query = getQuery(event);
	const eventQuery: EventsQuery = {};
	if (typeof query.organizerId === 'string') {
		eventQuery.organizerId = Number(query.organizerId);
	}

	if (typeof query.start === 'string') {
		eventQuery.start = DateTime.fromISO(query.start);
	}

	if (typeof query.end === 'string') {
		eventQuery.end = DateTime.fromISO(query.end);
	}

	if (typeof query.cities === 'string') {
		eventQuery.cities = query.cities.split(',');
	}

	eventQuery.loadFullEvent = query.format === 'full';

	return eventQuery;
}

async function fetchEvents(query: EventsQuery): Promise<EventInput[]> {
	const eventsWhere: any = {};
	if (query.start && query.end) {
		eventsWhere.start = {
			gte: query.start.toJSDate(),
			lt: query.end.toJSDate(),
		};
	}

	if (query.cities) {
		eventsWhere.source = {
			sourceCity: {
				in: query.cities,
			},
		};
	}

	let include = {};
	if (query.loadFullEvent) {
		include = {
			images: { select: { id: true } },
		};
	}

	const events = await prisma.urlEvent.findMany({
		where: {
			OR: [
				// Show events which have either:
				// - No TTL
				// - A TTL which has not yet expired (is in the future)
				// - A TTL which is not/was not expired at the time of the event's start (events which were in the past and unexpired at the time they began)
				{ hideAfter: null },
				{ hideAfter: { gte: new Date() } },
				{ hideAfter: { gte: prisma.urlEvent.fields.start } },
			],
			sourceId: query.organizerId,
			...eventsWhere,
		},
		orderBy: {
			start: 'asc',
		},
		include: {
			source: { select: { sourceName: true } },
			...include,
		},
	});

	const response = events
		.map((event) => urlEventToFullcalendar(event, [], { sourceName: event.source.sourceName, id: event.sourceId }))
		.map((e) => {
			if (!query.loadFullEvent) {
				e.extendedProps = undefined;
			}

			return e;
		});

	return response;
}
