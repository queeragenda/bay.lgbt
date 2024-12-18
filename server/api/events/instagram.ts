import { logger as mainLogger } from '~~/server/utils/logger';
import { CityEventListing } from '~~/types';
import { prisma } from '~~/server/utils/db';

const logger = mainLogger.child({ provider: 'instagram' });

export default defineEventHandler(async (event) => {
	try {
		const body = await fetchInstagramEvents();

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

async function fetchInstagramEvents(): Promise<CityEventListing[]> {
	const organizers = await prisma.instagramEventOrganizer.findMany({
		include: {
			events: {
				include: {
					post: {
						include: {
							images: {
								select: { id: true }
							}
						}
					}
				}
			},
		}
	});

	const response = organizers.map(organizer => ({
		city: organizer.city,
		events: organizer.events.map(event => ({
			postID: event.postID,
			title: event.title,
			start: event.start,
			end: event.end,
			url: event.url,
			organizerID: event.organizerId,
			createdAt: event.createdAt,
			images: event.post.images.map(img => `/api/images/instagram/${img.id}`),
		})),
		organizer: organizer.username,
	}));
	return response;
}
