import { UrlEvent, UrlSource } from "@prisma/client";
import sanitizeHtml from 'sanitize-html';
import { ApiEvent, ApiOrganizer } from "~~/types";

export function sourceToResponse(source: UrlSource): ApiOrganizer {
	return {
		name: source.sourceName,
		slug: urlIfy(source.sourceName),
		eventsUrl: `/api/list-events?organizerId=${source.id}`,
		city: source.sourceCity,
		lastScraped: source.lastScraped,
		id: source.id,
	}
}

export function urlEventToHttpResponse(event: UrlEvent, imageIds: number[], source: UrlSource): ApiEvent {
	let extendedProps: any = {};
	try {
		if (event.extendedProps) {
			extendedProps = JSON.parse(event.extendedProps);
			if (extendedProps.description) {

				/*
				=== SAFETEY ===
				It is unsafe to allow injection of arbitrary HTML into your Vue page. This endpoint MUST continue to use
				sanitize-html, as event organizers sometimes return HTML event descriptions, and in order to display them
				correctly we need to allow for HTML injection on the client side. EventModal.vue uses v-html to directly
				inject the description HTML into the page, so we MUST continue to sanitize the descriptions.
				===============
				*/
				extendedProps.description = sanitizeHtml(extendedProps.description);
			}
		}
	} catch (e) {
		logger.warn({ extendedProps: event.extendedProps, eventID: event.id, sourceID: event.sourceId, sourceName: source.sourceName }, 'Invalid JSON in extendedProps attribute, this is a bug!');
	}

	return {
		title: event.title,
		start: event.start,
		end: event.end,
		url: `/e/${urlIfy(source.sourceName)}/${event.id}/${urlIfy(event.title)}`,
		extendedProps: {
			createdAt: event.createdAt,
			originalUrl: event.url,
			organizer: source.sourceName,
			organizerId: source.id,
			images: imageIds.map(imageUrl),
			...extendedProps
		},
	};
}

export function imageUrl(imageId: number): string {
	return `/api/events/images/${imageId}`;
}

export function urlIfy(fragment: string): string {
	return fragment
		.toLowerCase()
		.replace(/^\s+/, '')
		.replace(/\s+$/, '')
		.replaceAll(/[()]*/g, '')
		.replaceAll(/[^a-zA-Z0-9]+/g, '-')
		.replaceAll(/-+/g, '-');
}
