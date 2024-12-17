import { scrapeInstagram } from "~~/server/utils/instagram";

export default defineEventHandler(async event => {
	const username = getRouterParam(event, 'username')

	const eventCounts = await scrapeInstagram({ username });

	return eventCounts;
});
