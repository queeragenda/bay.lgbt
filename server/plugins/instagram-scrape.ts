import { InstagramSource } from "~~/types";
import { getOrInsertOrganizer, scrapeInstagram } from "~~/utils/instagram";
import eventSourcesJSON from 'public/event_sources.json';
import { DateTime } from "luxon";

export default defineNitroPlugin(async (nitroApp) => {
	let sources: InstagramSource[] = eventSourcesJSON.instagram;
	await Promise.all(sources.map(source => getOrInsertOrganizer(source)));

	// Run the instagram scrape job every 10 minutes, it skips organizers that have been updated in the past hour. It's
	// re-run every 10 minutes so that if there were errors for any one organizer the last time it was run, it'll try
	// again.
	setInterval(() => runScrape(), 1000 * 60 * 10);

	runScrape();
})

function runScrape() {
	scrapeInstagram({ onlyUpdateStalerThan: DateTime.now().minus({ hours: 1 }) });
}
