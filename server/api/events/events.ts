import { logger as mainLogger } from '~~/server/utils/logger';
import { CityEventListing } from '~~/types';
import { prisma } from '~~/server/utils/db';
import { getQuery } from 'h3';

const logger = mainLogger.child({ provider: 'url-events' });

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const eventQuery: EventsQuery = {};
	if (typeof query.organizer === 'string') {
		eventQuery.organizer = query.organizer;
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
	organizer?: string
}

async function fetchEvents(query: EventsQuery): Promise<CityEventListing[]> {
	const sources = await prisma.urlSource.findMany({
		where: {
			sourceName: query.organizer,
		},
		include: {
			events: {
				include: {
					images: { select: { id: true } }
				}
			},
		}
	});

	if (sources.length === 0) {
		const matchText = query.organizer ? ` named ${query.organizer}` : '';
		throw createError({
			statusCode: 404,
			message: `No organizer found${matchText}`,
		})
	}

	const response = sources.map(source => ({
		city: source.sourceCity,
		organizer: source.sourceName,
		sourceType: source.sourceType,
		events: source.events.map(event => {
			let extendedProps = {};
			try {
				if (event.extendedProps) {
					JSON.parse(event.extendedProps);
				}
			} catch (e) {
				logger.warn({ extendedProps: event.extendedProps, eventID: event.id, sourceID: event.sourceId, sourceName: source.sourceName }, 'Invalid JSON in extendedProps attribute, this is a bug!');
			}

			return {
				title: event.title,
				start: event.start,
				end: event.end,
				url: event.url,
				createdAt: event.createdAt,
				images: event.images.map(img => `/api/images/events/${img.id}`),
				extendedProps,
			};
		}),
	}));

	return response;
}
