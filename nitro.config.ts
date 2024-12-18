// nitro.config.ts
import { defineNitroConfig } from "nitropack";
import { serverCacheMaxAgeSeconds, serverStaleWhileInvalidateSeconds } from './utils/util';

export default defineNitroConfig({
	routeRules: {
		'/api/events/': { cache: { swr: true, maxAge: 60, staleMaxAge: 60 } }
	},
});
