import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const KEYS_PATH = path.join(process.cwd(), '.dev-jwks.json');

interface Jwks {
  keys: Record<string, unknown>[];
}

// Loads the signing key. In production it comes from the environment, because a
// hosted container has no filesystem worth writing to: every deploy would mint a
// fresh key under the same `kid` and silently invalidate every token already
// issued. Locally it is generated once and cached in a file so restarts don't do
// the same thing.
export function loadJwks(): Jwks {
  if (process.env.OIDC_JWKS) {
    return JSON.parse(process.env.OIDC_JWKS) as Jwks;
  }

  if (existsSync(KEYS_PATH)) {
    return JSON.parse(readFileSync(KEYS_PATH, 'utf8')) as Jwks;
  }

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = privateKey.export({ format: 'jwk' }) as Record<string, unknown>;
  jwk.use = 'sig';
  jwk.alg = 'RS256';
  jwk.kid = 'persona-dev-1';

  const jwks: Jwks = { keys: [jwk] };
  writeFileSync(KEYS_PATH, JSON.stringify(jwks, null, 2));
  return jwks;
}
