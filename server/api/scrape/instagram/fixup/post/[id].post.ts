import { fixupInstagramIngestion } from "~~/utils/instagram";

export default defineEventHandler(async event => {
	const postID = getRouterParam(event, 'id');

	return await fixupInstagramIngestion({ postID });
});
