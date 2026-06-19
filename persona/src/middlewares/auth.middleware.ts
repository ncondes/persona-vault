import { RequestHandler } from 'express';
import { UnauthorizedError } from '../domain/errors';

// Rejects requests that do not have a logged-in session, and exposes the user id
// on the request for downstream handlers.
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) {
    throw new UnauthorizedError('Authentication required');
  }
  req.userId = req.session.userId;
  next();
};
