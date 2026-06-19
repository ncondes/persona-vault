import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

// Hashes a plaintext password for storage.
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// Checks a plaintext password against a stored hash.
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
