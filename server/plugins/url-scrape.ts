import { DateTime } from "luxon";
import { doUrlScrapes, initializeAllScrapers, scrapeInstagram } from '~~/server/utils/http';

export default defineNitroPlugin(async (nitroApp) => {
	await initializeAllScrapers();

	// Run the url scrape job every 10 minutes, it skips organizers that have been updated in the past hour. It's
	// re-run every 10 minutes so that if there were errors for any one organizer the last time it was run, it'll try
	// again.
	//
	if (process.env.SKIP_SCRAPE === 'true') {
		logger.warn('Skipping all scrapes due to SKIP_SCRAPE env var');
		return;
	}
	setInterval(() => runScrape(), 1000 * 60 * 10);

	runScrape();

	// Run the instagram scrape job every 60 minutes, it skips organizers that have been updated in the past two hours. It's
	// re-run every hour so that if there were errors for any one organizer the last time it was run, it'll try
	// again.
	if (process.env.SKIP_INSTAGRAM_SCRAPE === 'true') {
		logger.warn('Skipping Instgram scrapes due to SKIP_SCRAPE env var');
		return;
	}
	setInterval(() => runInstaScrape(), 1000 * 60 * 60);

	runInstaScrape();
})

function runScrape() {
	doUrlScrapes({ onlyUpdateStalerThan: DateTime.now().minus({ hours: 1 }) });
}

function runInstaScrape() {
	scrapeInstagram({ onlyUpdateStalerThan: DateTime.now().minus({ hours: 1 }) });
}
