import { logger as mainLogger } from '~~/server/utils/logger';
import { CityEventListing } from '~~/types';
import { prisma } from '~~/server/utils/db';
import { getQuery } from 'h3';
import { urlEventToHttpResponse } from '~~/server/utils/event-api';

const logger = mainLogger.child({ provider: 'url-events' });

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const eventQuery: EventsQuery = {};
	if (typeof query.organizerId === 'string') {
		eventQuery.organizerId = Number(query.organizerId);
	}

	try {
		const body = await fetchEvents(eventQuery);

		return {
			body
		}
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
}

async function fetchEvents(query: EventsQuery): Promise<CityEventListing[]> {
	const sources = await prisma.urlSource.findMany({
		where: {
			id: query.organizerId,
		},
		include: {
			events: {
				include: {
					images: { select: { id: true } }
				},
				orderBy: {
					start: 'asc',
				},
			},
		},
	});

	if (sources.length === 0) {
		const matchText = query.organizerId ? ` with id ${query.organizerId}` : '';
		throw createError({
			statusCode: 404,
			message: `No organizer found${matchText}`,
		})
	}

	const response = sources.map(source => ({
		city: source.sourceCity,
		organizer: source.sourceName,
		sourceType: source.sourceType,
		events: source.events.map(event => urlEventToHttpResponse(event, event.images.map(i => i.id), source)),
	}));

	return response;
}
