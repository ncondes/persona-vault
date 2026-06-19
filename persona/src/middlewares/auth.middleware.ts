import { RequestHandler } from 'express';
import { UnauthorizedError } from '../domain/errors';
import { verifyAuthToken } from '../infrastructure/auth/token';

// Rejects requests without a valid auth token cookie, and exposes the user id
// on the request for downstream handlers.
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.token as string | undefined;
  const userId = token ? verifyAuthToken(token) : null;
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }
  req.userId = userId;
  next();
};
