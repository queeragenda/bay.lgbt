export default defineEventHandler(async (event) => {
	const sources = await prisma.instagramEventOrganizer.findMany({
		orderBy: { username: 'asc' },
	});

	return sources;
});
