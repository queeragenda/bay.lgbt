import { fixupInstagramIngestion } from "~~/server/utils/instagram";

export default defineEventHandler(async event => {
	const username = getRouterParam(event, 'username')

	return await fixupInstagramIngestion({ username });
});
