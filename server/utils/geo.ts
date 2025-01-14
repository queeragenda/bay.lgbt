import { EventGeoJsonLocation } from "~~/types";

export function geoJson(longitude: any, latitude: any): EventGeoJsonLocation | undefined {
	if (latitude && typeof latitude === 'number' && longitude && typeof longitude === 'number') {
		return {
			type: 'Point',
			coordinates: [longitude, latitude]
		};
	}
}
