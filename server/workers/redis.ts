import IORedis from 'ioredis';

function maybeNumber(value: string | undefined): number | undefined {
	if (value) {
		const num = Number(value);
		if (isNaN(num)) {
			return;
		}

		return num;
	}
}

export const connection = new IORedis({
	host: process.env.BULL_REDIS_HOST,
	port: maybeNumber(process.env.BULL_REDIS_PORT),
	db: maybeNumber(process.env.BULL_REDIS_DB),
	maxRetriesPerRequest: null,
});
