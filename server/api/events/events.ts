import { logger as mainLogger } from '~~/server/utils/logger';
import { CityEventListing } from '~~/types';
import { prisma } from '~~/server/utils/db';

const logger = mainLogger.child({ provider: 'url-events' });

export default defineEventHandler(async (event) => {
	try {
		const body = await fetchEvents();

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

async function fetchEvents(): Promise<CityEventListing[]> {
	const sources = await prisma.urlSource.findMany({
		include: {
			events: {
				include: {
					images: { select: { id: true } }
				}
			},
		}
	});

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
