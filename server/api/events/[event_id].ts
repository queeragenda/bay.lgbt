import { logger as mainLogger } from '~~/server/utils/logger';
import { prisma } from '~~/server/utils/db';
import { urlEventToFullcalendar } from '~~/server/utils/event-api';

const logger = mainLogger.child({ provider: 'url-events' });

export default defineEventHandler(async (event) => {
	const eventID = Number(getRouterParam(event, 'event_id'));

	try {
		const body = await fetchEvent(eventID);

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

async function fetchEvent(id: number) {
	const event = await prisma.urlEvent.findFirst({
		where: {
			id
		},
		include: {
			images: { select: { id: true } },
			source: true,
		}
	});

	if (!event) {
		throw createError({
			statusCode: 404,
			message: `No event found with ID ${id}`,
		})
	}

	return urlEventToFullcalendar(event, event.images.map(i => i.id), event.source);
}
