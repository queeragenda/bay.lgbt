import { fixupInstagramIngestion } from "~~/utils/instagram";

export default defineEventHandler(async event => {
	return await fixupInstagramIngestion();
});
