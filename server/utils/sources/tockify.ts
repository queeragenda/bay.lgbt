import { logger as mainLogger } from '~~/server/utils/logger';
import { UrlSource } from '@prisma/client';
import { fetchCached, SourceFile, UrlEventInit, UrlScraper, UrlSourceInit } from '../http';
import { geoJson } from '../geo';

const logger = mainLogger.child({ provider: 'tockify' });


export class TockifyScraper implements UrlScraper {
	name = 'tockify';

	async scrape(source: UrlSource): Promise<UrlEventInit[]> {
		const url = new URL(source.url);
		// Add current date in milliseconds to the URL to get events starting from this moment.
		url.searchParams.append('startms', Date.now().toString());

		return await fetchCached(source, url, async response => {
			let tockifyJson = await response.json();
			let tockifyEvents = tockifyJson.events;

			return tockifyEvents.map((event: any) => convertTockifyEventToFullCalendarEvent(event, url, source.sourceName));
		});
	}

	generateSources(sources: SourceFile): UrlSourceInit[] {
		return sources.tockify.map(source => ({
			sourceName: source.name,
			url: source.url,
			sourceCity: source.city,
		}));
	}
}

function convertTockifyEventToFullCalendarEvent(e: any, url: URL, sourceName: string): UrlEventInit {
	const fullUrl = (e.content.customButtonLink)
		? e.content.customButtonLink
		: `${url.origin}/${url.searchParams.get('calname')}/detail/${e.eid.uid}/${e.eid.tid}`;

	let images = e.content.imageSets.map((image: any) => {
		return { url: `https://d3flpus5evl89n.cloudfront.net/${image.ownerId}/${image.id}/scaled_512.jpg` };
	});

	return {
		title: `${e.content.summary.text} @${sourceName} `,
		start: new Date(e.when.start.millis),
		end: new Date(e.when.end.millis),
		url: fullUrl,
		images,
		description: e.content.description.text,
		location: {
			geoJSON: geoJson(e.content.location?.longitude, e.content.location?.latitude),
			eventVenue: {
				name: e.content.place,
				address: {
					streetAddress: e.content?.location?.c_street,
					addressLocality: e.content?.location?.c_locality,
					addressRegion: e.content?.location?.c_region,
					postalCode: e.content?.location?.c_postcode,
					addressCountry: e.content?.location?.c_country
				},
				geo: {
					latitude: e.content?.location?.latitude,
					longitude: e.content?.location?.longitude
				}
			}
		}
	}
}
