import { logger as mainLogger } from '~~/server/utils/logger';
import { CityEventListing } from '~~/types';
import { prisma } from '~~/server/utils/db';
import sanitizeHtml from 'sanitize-html';
import { instagramEventToApiResponse, urlIfy } from '~~/server/utils/event-api';

const logger = mainLogger.child({ provider: 'instagram' });

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const eventQuery: EventsQuery = {};
	if (typeof query.username === 'string') {
		eventQuery.username = query.username;
	}

	try {
		const body = await fetchInstagramEvents(eventQuery);

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
	username?: string
}

async function fetchInstagramEvents(query: EventsQuery): Promise<CityEventListing[]> {
	const organizers = await prisma.instagramEventOrganizer.findMany({
		where: {
			username: query.username,
		},
		include: {
			events: {
				include: {
					post: {
						include: {
							images: {
								select: { id: true }
							},
						}
					}
				}
			},
		}
	});

	return organizers.map(organizer => ({
		city: organizer.city,
		organizer: organizer.username,
		events: organizer.events.map(event => instagramEventToApiResponse(
			event,
			event.post,
			event.post.images.map(i => i.id),
			organizer
		))
	}));
}
