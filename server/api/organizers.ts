import { sourceToResponse } from "../utils/event-api";

export default defineEventHandler(async (event) => {
	const sources = await prisma.urlSource.findMany({
		orderBy: { sourceName: 'asc' }
	});

	return sources.map(sourceToResponse);
});
