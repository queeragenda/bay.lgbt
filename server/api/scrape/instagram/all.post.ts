import { instagramQueue } from "~~/server/workers/instagram"

export default defineEventHandler(async event => {
	const job = await instagramQueue.add('scrape', {});

	return { job: job.id }
});

// TODO: require scrape token to be present for all /scrape endpoints
