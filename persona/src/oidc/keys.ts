import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SigningKeyService, JwkSet } from '../services/signing-key.service';
import { logger } from '../infrastructure/logger/logger';

type Jwk = Record<string, unknown>;

// Resolved when it is read rather than when the module loads, so the path
// follows the working directory instead of whatever it happened to be at import.
function cachedKeysPath(): string {
  return path.join(process.cwd(), '.dev-jwks.json');
}

// Reads a key set that already exists, from the environment or from the file a
// previous version cached on a laptop. Only consulted when the table is empty —
// once a key is in the database, these are ignored.
function existingKeySet(): Jwk[] {
  if (process.env.OIDC_JWKS) {
    const parsed = JSON.parse(process.env.OIDC_JWKS) as JwkSet;
    return parsed.keys ?? [];
  }
  const cached = cachedKeysPath();
  if (existsSync(cached)) {
    return (JSON.parse(readFileSync(cached, 'utf8')) as JwkSet).keys ?? [];
  }
  return [];
}

// Loads the signing keys, and moves the rollover on one step while it is there.
//
// This used to return a single key straight from the environment. A single key
// cannot be rotated: there is nowhere to publish its replacement before it signs
// and nowhere to keep it after it stops, so any change invalidates every token
// in flight. The keys live in Postgres now, encrypted at rest, and the set is
// ordered active-first because oidc-provider signs with the first key that
// matches the algorithm.
//
// The first boot after this change adopts whatever was in OIDC_JWKS, keeping its
// `kid` exactly as it was — tokens already issued carry that id in their header,
// and a verifier that cannot find it in the published set rejects them.
export async function loadJwks(service: SigningKeyService): Promise<JwkSet> {
  if (!(await service.active())) {
    for (const jwk of existingKeySet()) {
      await service.adopt(jwk);
      logger.info({ kid: jwk.kid }, 'adopted the existing signing key');
      break;
    }
  }

  await service.advance();
  return service.jwks();
}
