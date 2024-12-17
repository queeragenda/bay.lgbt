import { fixupInstagramIngestion } from "~~/server/utils/instagram";

export default defineEventHandler(async event => {
	return await fixupInstagramIngestion();
});
