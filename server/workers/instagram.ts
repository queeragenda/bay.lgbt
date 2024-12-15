import { Queue, Worker } from "bullmq";
import { scrapeAllInstagramEvents, fixupInstagramIngestion, scrapeInstagramEventsForUser } from "~~/utils/instagram";
import { connection } from "./redis";

const queue = new Queue("instagram", { connection });

const worker = new Worker('instagram', async job => {
	console.info({ job: job.id, name: job.name }, "Starting job")
	if (job.name === 'scrape-all') {
		await scrapeAllInstagramEvents();
	} if (job.name === 'scrape-user') {
		await scrapeInstagramEventsForUser(job.data.username);
	} else if (job.name === 'fixup-ingest') {
		await fixupInstagramIngestion();
	} else {
		console.error({ job_name: job.name }, 'Got unknown job name on instagram queue')
	}
	console.info({ job: job.id, name: job.name }, "Completed job")
}, { concurrency: 100, connection });

export async function initInstagramWorkers() {
	const scheduler = await queue.upsertJobScheduler(
		'scrape-every-hour',
		{ pattern: '46 * * * *' },
		{
			name: 'scrape-all',
			data: {
			},
		},
	);
}
