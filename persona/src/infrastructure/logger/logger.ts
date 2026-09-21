import pino from 'pino';
import { config } from '../../config/config';

// pino-http's default request serializer copies the whole header bag, so
// without this every production request line carried the `cookie` header — a
// usable seven-day session token, written to the log on every hit. These are
// the three headers that carry credentials.
export const REDACTION = '[redacted]';

export const REDACTED_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
];

export const logger = pino({
  level: config.isTest ? 'silent' : config.isProd ? 'info' : 'debug',
  redact: { paths: REDACTED_PATHS, censor: REDACTION },
});
