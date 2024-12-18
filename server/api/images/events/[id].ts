import { prisma } from "~~/server/utils/db";

export default defineEventHandler(async event => {
	const imageID = Number(getRouterParam(event, 'id'));
	if (isNaN(imageID)) {
		throw createError({
			statusCode: 400,
			message: 'id must be a valid number',
		});
	}

	const image = await prisma.urlEventImage.findFirst({ where: { id: imageID } });
	if (image) {
		event.node.res.setHeader('Content-Type', image.contentType);
		return image.data;
	}
});
