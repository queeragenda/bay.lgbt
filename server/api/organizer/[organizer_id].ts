import { sourceToResponse } from "~/server/utils/event-api";

export default defineEventHandler(async (event) => {
	const sourceID = Number(getRouterParam(event, 'organizer_id'));

	const source = await prisma.urlSource.findFirst({
		where: {
			id: sourceID,
		}
	});

	if (!source) {
		throw createError({
			statusCode: 404,
			message: `No source found with ID ${sourceID}`,
		});
	}

	return sourceToResponse(source);
});
