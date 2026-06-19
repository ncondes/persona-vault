import { RequestHandler } from 'express';
import { verifyAuthToken } from '../infrastructure/auth/token';

// Web pages redirect to /login when not signed in (the API returns 401 instead).
export const requireWebAuth: RequestHandler = (req, res, next) => {
  const token = req.cookies?.token as string | undefined;
  const userId = token ? verifyAuthToken(token) : null;
  if (!userId) {
    res.redirect('/login');
    return;
  }
  req.userId = userId;
  next();
};
