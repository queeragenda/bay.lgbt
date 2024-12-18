import { DateTime } from 'luxon';

import { logger as mainLogger } from '~~/server/utils/logger';
import { UrlSource } from '@prisma/client';
import { fetchCached, SourceFile, UrlEventInit, UrlScraper } from '../http';

const logger = mainLogger.child({ provider: 'forbidden-tickets' });

export class ForbiddenTicketsScraper implements UrlScraper {
	name = 'forbidden';

	async scrape(source: UrlSource) {
		return await fetchCached(source, source.url, async (response) => {
			const json = await response.json();

			if (!Array.isArray(json)) {
				logger.warn({ json, sourceName: source.sourceName }, 'Got invalid JSON back for source');
				return [];
			}

			return json.map((item: any) => ({
				title: `${item.title}`,
				url: item.url,
				start: DateTime.fromFormat(item.start, 'yyyy-MM-dd HH:mm:ss', { zone: 'UTC' }).toJSDate(),
				end: DateTime.fromFormat(item.end, 'yyyy-MM-dd HH:mm:ss', { zone: 'UTC' }).toJSDate(),
			}));
		});
	}

	generateSources(sources: SourceFile) {
		return sources.forbiddenTickets.map(source => ({
			url: `https://forbiddentickets.com/events/${source.username}/json`,
			sourceName: source.name,
			sourceID: source.username,
			sourceCity: source.city,
		}));
	}
}
