import eventSourcesJSON from '~~/server/utils/event_sources.json';
import { JSDOM } from 'jsdom';
import { DateTime } from 'luxon';
import { logger as mainLogger } from '~~/server/utils/logger';
import { UrlEvent, UrlSource } from '@prisma/client';
import { SourceFile, UrlScraper, UrlSourceInit, UrlEventInit } from '../http';

const logger = mainLogger.child({ provider: 'with-friends' });

export class WithFriendsScraper implements UrlScraper {
	name = 'with-friends';

	async scrape(source: UrlSource): Promise<UrlEventInit[]> {
		// TODO: update to POST and supply forum body https://github.com/queeragenda/bay.lgbt/blob/944be26d4ed4a5bb828c3547e021488abcab29cb/server/api/events/with-friends.ts#L25
		return fetchCached(source, source.url, async response => {
			const html = await response.text();
			const dom = new JSDOM(html);
			const eventsHtml = dom.window.document.querySelectorAll('.Event_List_Item');

			// Get event information.
			return [...eventsHtml].map(event => {
				// TODO: currently only parsing start date!!!
				let dateString = event.querySelector('[data-property="Start_Time"]')!
					.textContent!
					.trim()
					.replace(' at', ` ${new Date().getFullYear()}`);

				// With Friends supplies events from America/Los_Angeles timezone- not the system timezone.
				// Convert dateString, which is the format like `Friday, March 24 2023 8:30 PM`, to a UTC date.
				const start = DateTime.fromFormat(dateString, 'cccc, LLLL d yyyy h:mm a', { zone: 'America/Los_Angeles' }).toUTC();

				// Arbitrarily set end to be +3 hours from start.
				// const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
				const title = `${event.querySelector('[data-property="Name"]')!.textContent!.trim()} @ ${source.sourceName}`;
				const postUrl = 'https://withfriends.co' + event.querySelector('.wf-event-link')!.getAttribute('href');
				return {
					title,
					start: start.toJSDate(),
					end: start.toJSDate(),
					url: postUrl
				}
			});
		});
	}

	generateSources(sources: SourceFile): UrlSourceInit[] {
		return sources.withFriends.map(source => ({
			url: `https://withfriends.co/Movement/${source.movementId}/Incremental_Events:Display_Infinite_Scroll=1,Display_Item_Element=li,Display_Item_Classes=Event_List_Item%20wf-event%20wf-front,Display_Iterator_Element=None,Display_Increment=5,Display_Template_Alias=New_List,Display_Segment=Upcoming,Display_Property_Alias=Events,Display_Front=1,Display_Item_Type=Movement,Display_Item=${source.movementId}`,
			sourceName: source.name,
			sourceCity: source.city,
			sourceID: source.movementId,
		}))
	}
}
