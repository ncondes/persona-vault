import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const KEYS_PATH = path.join(process.cwd(), '.dev-jwks.json');

interface Jwks {
  keys: Record<string, unknown>[];
}

// Loads a development signing key, generating and caching one on first run so
// issued tokens stay valid across restarts. Production must supply real keys.
export function loadDevJwks(): Jwks {
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
