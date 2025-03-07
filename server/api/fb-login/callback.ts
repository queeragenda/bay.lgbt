import { logger as mainLogger } from '~~/server/utils/logger';
import { prisma } from '~~/server/utils/db';
import { getQuery } from 'h3';

const logger = mainLogger.child({ provider: 'fb-login-callback' });

export default defineEventHandler(async (event) => {
	try {
		const query = getQuery(event);
		if (typeof query.code === 'string') {
			await upgradeAndStoreToken(query.code);
			return sendRedirect(event, '/fb-login/success', 302);
		}

		logger.error({ query }, 'Facebook login callback missing expected query props');

		// return sendRedirect(event, '/fb-login/fail', 302);
		return "hmm no that didn't work";
	} catch (error: any) {
		logger.error({ error: error.toString(), stack: error.stack }, 'Failed to perform Facebook Login :(');

		throw createError({
			statusCode: 500,
			statusMessage: '' + error,
		})
	}
});

// The tokens that come back from the Facebook Login Redirect only live for a few minutes. This function takes this
// short-lived token and upgrades it into a longer-lived token with a 60d expiry window.
//
// https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
async function upgradeAndStoreToken(code: string) {
	const runtimeConfig = useRuntimeConfig()

	const params = new URLSearchParams({
		code,
		redirect_uri: runtimeConfig.public.facebookLoginRedirect,
		client_id: runtimeConfig.public.facebookClientId,
		client_secret: runtimeConfig.facebookClientSecret,
	});
	const url = `https://graph.facebook.com/v22.0/oauth/access_token?${params.toString()}`;

	logger.info({ params, url }, 'token request');

	const response = await fetch(url);

	if (response.status != 200) {
		throw new Error(`Got invalid response (${response.status}) from FB token upgrade: ${await response.text()}`);
	}

	const body = await response.json();

	const longToken = body.access_token;

	const now = new Date();
	const expiresMillis = body.expires_in * 1000;
	const expiresAt = new Date(now.getTime() + expiresMillis);

	await prisma.instagramToken.create({
		data: {
			token: longToken,
			expiresAt,
		}
	});
}
