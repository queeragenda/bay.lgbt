import { InstagramEvent, InstagramEventOrganizer, InstagramImage, InstagramPost, UrlEvent, UrlSource } from "@prisma/client";
import sanitizeHtml from 'sanitize-html';
import { ApiEvent } from "~~/types";

export function urlEventToHttpResponse(event: UrlEvent, source: UrlSource): ApiEvent {
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

	// TODO: store images on our server, put images into extended props returned from this handlers
	const { images, ...extendedPropsWithoutImage } = extendedProps;

	return {
		title: event.title,
		start: event.start,
		end: event.end,
		url: `/e/${urlIfy(source.sourceName.toLowerCase())}/${event.id}/${urlIfy(event.title)}`,
		extendedProps: {
			createdAt: event.createdAt,
			originalUrl: event.url,
			organizer: source.sourceName,
			...extendedPropsWithoutImage
		},
	};
}

export function instagramEventToApiResponse(event: InstagramEvent, post: InstagramPost, imageIds: number[], organizer: InstagramEventOrganizer): ApiEvent {
	// TODO: store images on our server, put images into extended props returned from this handlers
	return {
		title: event.title,
		start: event.start,
		end: event.end,
		url: `/i/${urlIfy(organizer.username.toLowerCase())}/${event.postID}/${urlIfy(event.title)}`,
		extendedProps: {
			createdAt: event.createdAt,
			originalUrl: event.url,
			organizer: organizer.username,
			description: sanitizeHtml(post.caption),
			images: imageIds.map(id => `/api/images/instagram/${id}`)
		},
	};
}

export function urlIfy(fragment: string): string {
	return fragment
		.toLowerCase()
		.replace(/^\s+/, '')
		.replace(/\s+$/, '')
		.replaceAll(/[ @.&:+/]+/g, '-')
		.replaceAll(/[()]*/g, '')
		.replaceAll(/-+/g, '-');
}
