import { PrismaClient, Prisma } from "@prisma/client";

const logItems: (Prisma.LogLevel | Prisma.LogDefinition)[]  = [];

if (process.env.NODE_ENV === 'development') {
	logItems.push('query');
}

export const prisma = new PrismaClient({
	log: logItems,
});
