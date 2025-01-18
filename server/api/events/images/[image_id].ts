import { prisma } from "~~/server/utils/db";

export default defineEventHandler(async event => {
	const imageID = Number(getRouterParam(event, 'image_id'));
	if (isNaN(imageID)) {
		throw createError({
			statusCode: 400,
			message: 'id must be a valid number',
		});
	}

	const image = await prisma.urlEventImage.findFirst({ where: { id: imageID } });
	if (image) {
		// TODO: content-type probably should be set from db
		event.node.res.setHeader('Content-Type', 'image/jpeg');
		return image.data;
	}
});
