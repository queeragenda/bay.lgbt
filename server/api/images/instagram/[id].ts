import { instagramQueue } from "~~/server/workers/instagram"
import { prisma } from "~~/utils/db";

export default defineEventHandler(async event => {
	const imageID = Number(getRouterParam(event, 'id'));
	if (isNaN(imageID)) {
		throw createError({
			statusCode: 400,
			message: 'id must be a valid number',
		});
	}

	const image = await prisma.instagramImage.findFirst({ where: { id: imageID } });
	if (image) {
		event.node.res.setHeader('Content-Type', 'image/jpeg');
		return image.data;
	}
});
