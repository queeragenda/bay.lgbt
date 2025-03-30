import { CookieRef } from "nuxt/app";

export interface CityEnablement {
	[cityID: string]: boolean
}

export function useCityEnablement(): CookieRef<CityEnablement> {
	return useCookie<CityEnablement>('cityEnablement', {
		default: () => Object.fromEntries(allCities().map(c => [c.id, true]))
	});
}
