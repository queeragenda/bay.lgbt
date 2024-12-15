import { instagramQueue } from "~~/server/workers/instagram"

export default defineEventHandler(async event => {
	const job = await instagramQueue.add('fixup', {});
	console.info({ job: job.id }, 'queuing job to fixup instagram scraping');

	return { job: job.id };
});
