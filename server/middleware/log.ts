import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';

export default fromNodeMiddleware(pinoHttp({
  logger,
  redact: {
      paths: ['req.headers', 'res.headers'],
  }
}));
