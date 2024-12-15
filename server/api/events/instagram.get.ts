import { serverStaleWhileInvalidateSeconds } from '~~/utils/util';
import { logger as mainLogger } from '~~/utils/logger';
import { findEvents } from '~~/utils/instagram';
import { CityEventListing } from '~~/types';

const logger = mainLogger.child({ provider: 'instagram' });

export default defineCachedEventHandler(async (event) => {
	try {
		const body = await fetchInstagramEvents();

		return {
			body
		}
	} catch (error) {
		logger.error({ error: error.toString(), stack: error.stack }, 'Failed to fetch events');
		throw createError({
			statusCode: 500,
			statusMessage: '' + error,
		})
	}
}, {
	maxAge: 60,
	staleMaxAge: serverStaleWhileInvalidateSeconds,
	swr: true,
});

async function fetchInstagramEvents(): Promise<CityEventListing[]> {
	const organizersById = await findEvents({});

	return Object.values(organizersById).map(({ organization, events }) => ({
		city: organization.city,
		events,
	}));
}
