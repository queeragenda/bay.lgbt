import { type EventInput } from '@fullcalendar/core';

interface SourceFile {
	instagram: InstagramSource[];
}

interface InstagramSource {
	name: string;
	username: string;
	context_clues: string[];
	city: string;
}

interface InstagramApiGetPostsResponse {
	business_discovery: { media: { data: InstagramApiPost[] } }
}

// The fields that come back on an Instagram post from our API call
export interface InstagramApiPost {
	caption?: string
	permalink: string
	timestamp: string
	media_type: string
	media_url: string
	children?: { data: InstagramApiPostChild[] }
	id: string
}

export interface InstagramApiPostChild {
	media_url: string
	media_type: string
	id: string
}

export interface CityEventListing {
	city: string
	organizer: string
	events: EventInput[]
}
