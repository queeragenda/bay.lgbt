import { createError, defineEventHandler, getRouterParam, sendRedirect, setHeader } from 'h3';
import { prisma } from '~~/server/utils/db';
import { sfEagleOutgoingUrl } from '~~/server/utils/sf-eagle-outgoing';

export default defineEventHandler(async (event) => {
	setHeader(event, 'Cache-Control', 'no-store');
	const parameter = getRouterParam(event, 'event_id') || '';
	const id = Number(parameter);
	if (!/^[1-9]\d*$/.test(parameter) || !Number.isSafeInteger(id)) {
		throw createError({ statusCode: 400, statusMessage: 'Invalid event ID' });
	}
	const stored = await prisma.urlEvent.findUnique({ where: { id }, include: { source: true } });
	if (!stored) throw createError({ statusCode: 404, statusMessage: 'Event not found' });
	return sendRedirect(event, await sfEagleOutgoingUrl(stored, stored.source), 302);
});
