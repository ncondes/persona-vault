import pinoHttp from 'pino-http';
import { logger } from '../infrastructure/logger/logger';

// Logs one line per HTTP request/response.
export const requestLogger = pinoHttp({ logger });
