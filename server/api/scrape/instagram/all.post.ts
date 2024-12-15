import { scrapeInstagram } from "~~/utils/instagram";

export default defineEventHandler(async event => {
	const eventCounts = await scrapeInstagram();

	return eventCounts;
});

// TODO: require scrape token to be present for all /scrape endpoints
