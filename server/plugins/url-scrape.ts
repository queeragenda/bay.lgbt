import { DateTime } from "luxon";
import { doUrlScrapes, initializeAllScrapers } from '~~/server/utils/http';

export default defineNitroPlugin(async (nitroApp) => {
	initializeAllScrapers();

	// Run the url scrape job every 10 minutes, it skips organizers that have been updated in the past hour. It's
	// re-run every 10 minutes so that if there were errors for any one organizer the last time it was run, it'll try
	// again.
	setInterval(() => runScrape(), 1000 * 60 * 10);

	runScrape();
})

function runScrape() {
	doUrlScrapes({ onlyUpdateStalerThan: DateTime.now().minus({ hours: 1 }) });
}
