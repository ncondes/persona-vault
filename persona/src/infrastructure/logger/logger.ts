import pino from 'pino';
import { config } from '../../config/config';

export const logger = pino({
  level: config.isTest ? 'silent' : config.isProd ? 'info' : 'debug',
});
