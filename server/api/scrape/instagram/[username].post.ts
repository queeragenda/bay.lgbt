import { instagramQueue } from "~~/server/workers/instagram"

export default defineEventHandler(async event => {
	const username = getRouterParam(event, 'username')

	const job = await instagramQueue.add('scrape', { username });
	console.info({ username, job: job.id }, 'queuing job for user-specific instagram scraping');

	return { job: job.id };
});
