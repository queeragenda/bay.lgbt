import { SourceFile } from "~/server/utils/http";

export interface County extends City {
	cities: City[]
}

export interface City {
	id: string
	name: string
}

export const COUNTIES: County[] = [
	{ id: 'marin-county', name: 'Marin', cities: [] },
	{
		id: 'sf-county', name: 'SF-San Mateo',
		cities: [{ id: 'sf', name: 'San Francisco' }]
	},
	{
		id: 'alameda-county', name: 'Alameda',
		cities: [
			{ id: 'oakland', name: 'Oakland' },
			{ id: 'berkeley', name: 'Berkeley' },
		]
	},
	{
		id: 'santa-clara-county', name: 'Santa Clara',
		cities: [
			{ id: 'san-jose', name: 'San Jose' },
		]
	},
	{
		id: 'santa-cruz-county', name: 'Santa Cruz',
		cities: [
			{ id: 'santa-cruz', name: 'Santa Cruz' },
		]
	},
];

export function countyToCities(): { [countyID: string]: string[] } {
	const countyToCities: { [countyID: string]: string[] } = {};
	for (let county of COUNTIES) {
		countyToCities[county.id] = [...county.cities.map(c => c.id), county.id];
	}

	return countyToCities;
}

export function allCities(): City[] {
	return [
		...COUNTIES.map(c => ({ id: c.id, name: c.name })),
		...COUNTIES.flatMap(c => c.cities),
	];
}

export function validateCitiesInSourceFile(sourcesFile: SourceFile) {
	const cityNames = allCities().map(c => c.id);

	for (let key of Object.keys(sourcesFile)) {
		const sourceKind: any[] = (sourcesFile as any)[key];
		for (let source of sourceKind) {
			const cityName = source.city;
			const sourceName = source.name;

			if (!cityNames.includes(cityName)) {
				logger.error({
					sourceType: key,
					sourceName: sourceName,
					cityName: cityName,
				}, 'Source had invalid city name!');
			}
		}
	}
}
