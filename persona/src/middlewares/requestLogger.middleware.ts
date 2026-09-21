import pinoHttp from 'pino-http';
import { logger, REDACTION } from '../infrastructure/logger/logger';

// The authorize request carries `state`, `login_hint` and `code_challenge` in
// its query string, and login_hint is an email address. The path is what makes
// a log line useful; the query string is what makes it a disclosure.
export function scrubQuery(url: string): string {
  const query = url.indexOf('?');
  return query === -1 ? url : `${url.slice(0, query)}?${REDACTION}`;
}

// Logs one line per HTTP request/response.
export const requestLogger = pinoHttp({
  logger,
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: scrubQuery(req.url),
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort,
      };
    },
  },
});
