import { getOrInsertOrganizer, scrapeInstagram } from "~~/server/utils/instagram";
import eventSourcesJSON from '~~/server/utils/event_sources.json';
import { DateTime } from "luxon";

export default defineNitroPlugin(async (nitroApp) => {
	await Promise.all(eventSourcesJSON.instagram.map(source => getOrInsertOrganizer(source)));

	// Run the instagram scrape job every 60 minutes, it skips organizers that have been updated in the past two hours. It's
	// re-run every hour so that if there were errors for any one organizer the last time it was run, it'll try
	// again.
	setInterval(() => runScrape(), 1000 * 60 * 10);

	runScrape();
})

function runScrape() {
	scrapeInstagram({ onlyUpdateStalerThan: DateTime.now().minus({ hours: 2 }) });
}
