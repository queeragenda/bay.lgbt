import { initInstagramWorkers } from "../workers/instagram";

export default defineNitroPlugin((nitroApp) => {
	initInstagramWorkers();
})
