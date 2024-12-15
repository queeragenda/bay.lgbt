import { instagramQueue } from "~~/server/workers/instagram"

export default defineEventHandler(async event => {
	const postID = getRouterParam(event, 'id')

	const job = await instagramQueue.add('fixup', { postID });
	console.info({ job: job.id, postID }, 'queuing job to fixup instagram scraping');

	return { job: job.id };
});
