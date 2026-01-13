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
		})
	}
});

interface EventsQuery {
	organizerId?: number
	cities?: string[],
	start?: DateTime
	end?: DateTime
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
			}
		};
	}

	const events = await prisma.urlEvent.findMany({
		where: {
			sourceId: query.organizerId,
			...eventsWhere,
		},
		orderBy: {
			start: 'asc',
		},
		include: {
			images: { select: { id: true } },
			source: { select: { sourceName: true } },
		},
	});

	const response = events
		.map(event => urlEventToFullcalendar(event, event.images.map(i => i.id), { sourceName: event.source.sourceName, id: event.sourceId }))
		.map(e => {
			// You don't need to load every event description here
			if (e.extendedProps) {
				e.extendedProps.description = null;
			}

			return e;
		});

	return response;
}
