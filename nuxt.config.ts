// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	typescript: {
		// This ignores errors on build too.
		typeCheck: false
	},
	modules: [
		'nuxt-security'
	],
	pages: true,
	// See https://nuxt-security.vercel.app/getting-started/quick-start for info on security.
	security: {
		rateLimiter: {
			value: {
				tokensPerInterval: process.dev ? 999999 : 30,
				interval: "hour",
				fireImmediately: false
			},
			route: '',
			throwError: false, // optional
		},
		requestSizeLimiter: {
			value: {
				maxRequestSizeInBytes: 8000, // Most browsers have a request limit of 8KB, but this is to be safe.
				maxUploadFileRequestInBytes: 1000000,
			},
			route: '',
			throwError: false // optional,
		},
		allowedMethodsRestricter: {
			value: [
				'GET',
				// 'POST', // To resolve HTTP 405 errors and allow POST requests to hit the scrape endpoints (at time of writing this would allow anyone to trigger an Instagram scrape, using API rate limit time!), uncomment this line
			],
			route: '',
		},
		corsHandler: {
			value: {
				origin: '*',
				methods: '*',
			},
			route: ''
		}
	},
	plugins: [{ src: '~/plugins/vercel.ts', mode: 'client' }],
	css: ['vue-final-modal/style.css'],
})
