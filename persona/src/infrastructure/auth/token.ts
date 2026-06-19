import jwt from 'jsonwebtoken';
import { config } from '../../config/config';

const EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Signs an auth token carrying the user id.
export function signAuthToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.authSecret, { expiresIn: EXPIRES_IN_SECONDS });
}

// Returns the user id from a valid token, or null if it is missing or invalid.
export function verifyAuthToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, config.authSecret);
    if (typeof payload === 'object' && typeof payload.sub === 'string') {
      return payload.sub;
    }
    return null;
  } catch {
    return null;
  }
}
