import { type EventInput } from '@fullcalendar/core';
import * as FC from '@fullcalendar/core';

interface InstagramApiGetPostsResponse {
	business_discovery: { media: { data: InstagramApiPost[] } }
}

export interface ApiEvent {
	title: string
	start: string | Date
	end: string | Date
	url: string
	extendedProps: EventExtendedProps
}

export interface EventExtendedProps {
	description?: string
	location?: EventLocation
	images?: string[]
	createdAt: string | Date
	originalUrl: string
	organizer: string
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

export interface EventLocation {
	geoJSON?: EventGeoJsonLocation
	eventVenue?: EventVenue
}

export interface EventGeoJsonLocation {
	type: 'Point',
	coordinates: [number, number]
}

export interface EventVenue {
	name?: string
	address?: VenueAddress
	geo?: VenueGeo
}

export interface VenueGeo {
	latitude?: number
	longitude?: number
}

export interface VenueAddress {
	streetAddress?: string
	addressLocality?: string
	addressRegion?: string
	postalCode?: string
	addressCountry?: string
}
