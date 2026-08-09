import { config } from '../../config/config';

// The session cookie is set by both the API login and the OIDC interaction
// login, and read by requireAuth. One definition so the paths cannot drift.
export const AUTH_COOKIE = 'token';

const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

export const authCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProd,
  path: '/',
};

export const authCookieSetOptions = { ...authCookieOptions, maxAge: SEVEN_DAYS };
