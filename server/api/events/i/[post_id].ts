import { logger as mainLogger } from '~~/server/utils/logger';
import { prisma } from '~~/server/utils/db';
import { instagramEventToApiResponse } from '~~/server/utils/event-api';

const logger = mainLogger.child({ provider: 'url-events' });

export default defineEventHandler(async (event) => {
	const postID = getRouterParam(event, 'post_id');

	try {
		const body = await fetchEvent(postID);

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

async function fetchEvent(postID: string) {
	const event = await prisma.instagramEvent.findFirst({
		where: {
			postID
		},
		include: {
			post: { include: { images: { select: { id: true } } } },
			organizer: true,
		}
	});

	if (!event) {
		throw createError({
			statusCode: 404,
			message: `No post found with ID ${postID}`,
		})
	}

	return instagramEventToApiResponse(event, event.post, event.post.images.map(i => i.id), event.organizer);
}
