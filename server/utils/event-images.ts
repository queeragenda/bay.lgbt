import { UrlSource } from '@prisma/client';
import { JSDOM } from 'jsdom';

export function extractImagesFromPost(source: UrlSource, eventBody: string): string[] {
	const jsdom = new JSDOM(eventBody);
	const images = jsdom.window.document.querySelectorAll('img');

	const imageUrls: string[] = [];

	for (let img of images) {
		if (img.src.startsWith('https://')) {
			imageUrls.push(img.src);
		}
	}

	return imageUrls;
}
