import pino from 'pino';
import { config } from '../../config/config';

// Application logger. Quiet during tests, verbose in development.
export const logger = pino({
  level: config.isTest ? 'silent' : config.isProd ? 'info' : 'debug',
});
