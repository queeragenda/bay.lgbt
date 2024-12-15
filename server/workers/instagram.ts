import { Queue, Worker } from "bullmq";
import { scrapeAllInstagramEvents, fixupInstagramIngestion, scrapeInstagramEventsForUser } from "~~/utils/instagram";
import { connection } from "./redis";

export const instagramQueue = new Queue("instagram", { connection });

const worker = new Worker('instagram', async job => {
	console.info({ job: job.id, name: job.name }, "Starting job")
	switch (job.name) {
		case 'scrape-all':
			await scrapeAllInstagramEvents();
			break;
		case 'scrape-user':
			await scrapeInstagramEventsForUser(job.data.username);
			break;
		case 'fixup-ingest':
			await fixupInstagramIngestion();
			break;
		default:
			console.error({ job_name: job.name }, 'Got unknown job name on instagram queue')
			return;
	}

	console.info({ job: job.id, name: job.name }, "Completed job")
}, { concurrency: 100, connection });

export async function initInstagramWorkers() {
	// const scheduler = await instagramQueue.upsertJobScheduler(
	// 	'scrape-every-hour',
	// 	{ pattern: '52 * * * *' },
	// 	{
	// 		name: 'scrape-all',
	// 		data: {
	// 		},
	// 	},
	// );
}
