import { ErrorRequestHandler } from 'express';
import { AppError, TooManyRequestsError } from '../domain/errors';
import { logger } from '../infrastructure/logger/logger';

// Turns any thrown error into a consistent JSON error response.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    // The only header any error sets. RFC 9110 defines it in seconds, and a
    // sub-second wait still has to say 1 or a client reads it as "now".
    if (err instanceof TooManyRequestsError && err.retryAfterSeconds !== undefined) {
      res.setHeader('Retry-After', String(Math.max(1, err.retryAfterSeconds)));
    }
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, fields: err.fields },
    });
    return;
  }

  logger.error({ err }, 'unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' },
  });
};
