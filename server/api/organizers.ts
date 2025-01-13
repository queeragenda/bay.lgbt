export default defineEventHandler(async (event) => {
	const sources = await prisma.urlSource.findMany({
		orderBy: { sourceName: 'asc' }
	});

	return sources;
});
