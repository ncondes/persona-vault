import { ErrorRequestHandler } from 'express';
import { AppError } from '../domain/errors';
import { logger } from '../infrastructure/logger/logger';

// Turns any thrown error into a consistent JSON error response.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
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
