// https://nuxt.com/docs/api/configuration/nuxt-config
export default {
	typescript: {
		// This ignores errors on build too.
		typeCheck: false
	},

	runtimeConfig: {
		public: {
			facebookClientId: process.env.FACEBOOK_CLIENT_ID || '',
			facebookLoginRedirect: `${process.env.BASE_URL}/api/fb-login/callback` || '',
			baseUrl: process.env.BASE_URL || '',
		},

		facebookClientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
	},

	modules: ['nuxt-security', '@artmizu/nuxt-prometheus'],

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
		},
		// Uncomment this to make nuxt devtools work (idk why this is required, i don't like it!)
		// headers: {
		// 	contentSecurityPolicy: {
		// 		'script-src': ["'nonce-{{nonce}}'", "'strict-dynamic'"],
		// 	},
		// 	// 2.
		// 	crossOriginEmbedderPolicy: false,
		// },
	},

	css: ['vue-final-modal/style.css'],
	compatibilityDate: '2025-01-14',

	ssr: true,

	nitro: {
		routeRules: {
			'/api/events/': { cache: { swr: true, maxAge: 60, staleMaxAge: 60 } }
		},
	}
}
