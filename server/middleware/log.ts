import pinoHttp from 'pino-http';
import { logger } from '~~/server/utils/logger';

export default fromNodeMiddleware(pinoHttp({
	logger,
	redact: {
		paths: ['req.headers', 'res.headers'],
	}
}));
