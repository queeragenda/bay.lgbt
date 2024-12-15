import { instagramQueue } from "~~/server/workers/instagram"

export default defineEventHandler(async event => {
	const username = getRouterParam(event, 'username')


	const job = await instagramQueue.add('fixup', { username });
	console.info({ job: job.id, username }, 'queuing job to fixup instagram scraping');

	return { job: job.id };
});
