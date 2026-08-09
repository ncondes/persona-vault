import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { OTP_LENGTH } from '../../constants/otp';

const CEILING = 10 ** OTP_LENGTH;

// randomInt, not Math.random: this is a credential. Zero-padded rather than
// range-shifted so every code from 000000 to 999999 is equally likely.
export function generateOtp(): string {
  return String(randomInt(0, CEILING)).padStart(OTP_LENGTH, '0');
}

// Plain SHA-256 rather than bcrypt. A six-digit code lives for ten minutes and
// survives five guesses, so its whole keyspace is already searchable — the hash
// is here to keep the code out of the database and the logs, not to slow an
// attacker who has both.
export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function otpMatches(code: string, hash: string): boolean {
  const candidate = Buffer.from(hashOtp(code), 'hex');
  const expected = Buffer.from(hash, 'hex');
  // Digests are always the same length, but a corrupted row must not throw.
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
