import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { config } from '../../config/config';

// oidc-provider compares client secrets in plaintext, so they cannot be hashed
// the way user passwords are. They are encrypted at rest instead and decrypted
// only when the OIDC adapter loads a client. Rotating AUTH_SECRET invalidates
// every stored secret, which is why the console can regenerate them.
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

const key = Buffer.from(
  hkdfSync(
    'sha256',
    config.authSecret,
    Buffer.from('persona.client-secret'),
    Buffer.from(ALGORITHM),
    32,
  ),
);

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

export function decryptSecret(packed: string): string {
  const raw = Buffer.from(packed, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, raw.subarray(0, IV_BYTES));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  const plain = Buffer.concat([
    decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}

export function generateClientSecret(): string {
  return randomBytes(32).toString('base64url');
}
