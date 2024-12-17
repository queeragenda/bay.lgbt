import eventSourcesJSON from '~~/server/utils/event_sources.json';
import { DateTime } from 'luxon';
import { logger as mainLogger } from '~~/server/utils/logger';
import { UrlSource } from '@prisma/client';
import { SourceFile, UrlEventInit, UrlScraper, UrlSourceInit } from '../http';

const logger = mainLogger.child({ provider: 'wix' });

export class WixScraper implements UrlScraper {
	name = 'wix';

	async scrape(source: UrlSource): Promise<UrlEventInit[]> {
		// TODO: fix header passing!
		const headers = {
			// These are the 3 headers required to bypass OAuth. See https://dev.wix.com/api/rest/getting-started/api-keys
			// 'Authorization': process.env[source.api_key_envvar],
			// 'wix-account-id': process.env[source.account_id_envvar],
			// 'wix-site-id': process.env[source.site_id_envvar]
		};

		// TODO: POST
		// {
		// 					method: 'POST',
		// 					headers,
		// 					body: JSON.stringify({
		// 						"offset": 0,
		// 						// Max limit is 1000.
		// 						"limit": 1000,
		// 						"order": "start:asc",
		// 						"filter": {
		// 							"status": {
		// 								"$hasSome": ["ENDED", "SCHEDULED", "STARTED"]
		// 							}
		// 						},
		// 						"fieldset": ["URLS"],
		// 						"facet": ["status"],
		// 					})
		// 				}
		return fetchCachedWithHeaders(source, source.url, headers, async response => {
			const json = await response.json();
			return json.events.map((e: any) => {
				const timeZone = e.scheduling.config.timeZoneId;
				return {
					start: DateTime.fromISO(e.scheduling.config.startDate, { zone: timeZone }).toUTC().toJSDate(),
					end: DateTime.fromISO(e.scheduling.config.endDate, { zone: timeZone }).toUTC().toJSDate(),
					title: `${e.title} @ ${source.sourceName}`,
					url: e.eventPageUrl.base + e.eventPageUrl.path
				};
			});
		});
	}

	generateSources(sources: SourceFile): UrlSourceInit[] {
		return sources.wix.map(source => {
			if (process.env[source.api_key_envvar] === undefined) {
				throw new Error(`No Wix API key named ${source.api_key_envvar} found for ${source.name}. Consider setting this environment variable.`);
			}
			if (process.env[source.account_id_envvar] === undefined) {
				throw new Error(`No Wix account ID named ${source.account_id_envvar} found for ${source.name}. Consider setting this environment variable.`);
			}
			if (process.env[source.site_id_envvar] === undefined) {
				throw new Error(`No Wix site ID named ${source.site_id_envvar} found for ${source.name}. Consider setting this environment variable.`);
			}

			// TODO: ensure that it's okay that we store multiple entries for the same URL here
			// TODO: figure out how to send the env var stuff from here to the scrape fn
			return {
				url: 'https://www.wixapis.com/events/v1/events/query',
				sourceName: source.name,
				sourceCity: source.city,
				sourceID: source.site_id_envvar,
			};
		})
	}
}
