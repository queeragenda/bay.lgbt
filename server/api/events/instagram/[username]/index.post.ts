import { instagramQueue } from "~~/server/workers/instagram"

export default defineEventHandler(async event => {
	const username = getRouterParam(event, 'username')

	const job = await instagramQueue.add('scrape-user', { username });

	return { job: job.id }
});
