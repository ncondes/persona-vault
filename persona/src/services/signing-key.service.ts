import { createHash, generateKeyPairSync } from 'node:crypto';
import {
  KEY_ALG,
  KEY_MODULUS_BITS,
  KEY_PUBLISH_LEAD_MS,
  KEY_RETIRE_AFTER_MS,
  KEY_ROTATION_INTERVAL_MS,
} from '../constants/keys';
import { SigningKeyRepository } from '../domain/interfaces/signing-key.repository';
import { SigningKey } from '../domain/models';
import { decryptSecret, encryptSecret } from '../infrastructure/crypto/secret-box';
import { logger } from '../infrastructure/logger/logger';

type Jwk = Record<string, unknown>;

export interface JwkSet {
  keys: Jwk[];
}

// RFC 7638. The thumbprint is a hash of the key's required members in lexical
// order with no whitespace, so the same key always yields the same id and two
// different keys cannot collide on one — which the old hardcoded
// 'persona-dev-1' could and did, in every checkout at once.
export function thumbprint(jwk: Jwk): string {
  const required = { e: jwk.e, kty: jwk.kty, n: jwk.n };
  return createHash('sha256').update(JSON.stringify(required)).digest('base64url');
}

// The members that make a JWK private. Anything else is safe to publish.
const PRIVATE_MEMBERS = ['d', 'p', 'q', 'dp', 'dq', 'qi'];

export function publicMembersOf(jwk: Jwk): Jwk {
  return Object.fromEntries(
    Object.entries(jwk).filter(([member]) => !PRIVATE_MEMBERS.includes(member)),
  );
}

function generate(): { publicJwk: Jwk; privateJwk: Jwk; kid: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: KEY_MODULUS_BITS,
  });
  const privateJwk = privateKey.export({ format: 'jwk' }) as Jwk;
  const publicJwk = publicKey.export({ format: 'jwk' }) as Jwk;
  const kid = thumbprint(publicJwk);

  for (const jwk of [privateJwk, publicJwk]) {
    jwk.use = 'sig';
    jwk.alg = KEY_ALG;
    jwk.kid = kid;
  }
  return { publicJwk, privateJwk, kid };
}

// Manages the rollover. Three states, and the only one that signs is `active`:
// oidc-provider signs with the first key in the set matching the algorithm, so
// ordering the set active-first is what makes that true.
//
//   incoming   published, signing nothing — so a verifier has seen it before it
//              ever meets a token under that kid
//   active     signs
//   retiring   published for verification only, until every token it signed has
//              expired
export class SigningKeyService {
  constructor(
    private readonly keys: SigningKeyRepository,
    private readonly now: () => number = Date.now,
  ) {}

  // The set handed to oidc-provider, private halves included: the provider
  // needs them to sign, and it publishes only the public members at /oidc/jwks.
  async jwks(): Promise<JwkSet> {
    const stored = await this.keys.listPublished();
    return { keys: stored.map((key) => JSON.parse(decryptSecret(key.privateEncrypted)) as Jwk) };
  }

  async active(): Promise<SigningKey | null> {
    const published = await this.keys.listPublished();
    return published.find((key) => key.state === 'active') ?? null;
  }

  // Adds a key in whichever state the caller asks for. `active` is for the very
  // first key, where there is nothing to roll over from.
  async mint(state: 'incoming' | 'active' = 'incoming'): Promise<SigningKey> {
    const { publicJwk, privateJwk, kid } = generate();
    const at = new Date(this.now());
    return this.keys.create({
      kid,
      alg: KEY_ALG,
      publicJwk,
      privateEncrypted: encryptSecret(JSON.stringify(privateJwk)),
      state,
      createdAt: at,
      activatedAt: state === 'active' ? at : null,
    });
  }

  // Takes a key set that already exists — the one in OIDC_JWKS, or the one
  // cached on disk — and stores it as the active key.
  //
  // Its `kid` is kept exactly as it was rather than recomputed. Tokens already
  // in flight carry the old id in their header, and a verifier that cannot find
  // it in the published set rejects them; recomputing would break every ID token
  // issued in the hour before the deploy.
  async adopt(jwk: Jwk): Promise<SigningKey> {
    const kid = typeof jwk.kid === 'string' ? jwk.kid : thumbprint(jwk);
    const stored: Jwk = { ...jwk, kid, use: jwk.use ?? 'sig', alg: jwk.alg ?? KEY_ALG };

    const at = new Date(this.now());
    return this.keys.create({
      kid,
      alg: String(stored.alg),
      publicJwk: publicMembersOf(stored),
      privateEncrypted: encryptSecret(JSON.stringify(stored)),
      state: 'active',
      createdAt: at,
      activatedAt: at,
    });
  }

  // Replaces the active key immediately and removes every other, for a key that
  // must stop being trusted now.
  //
  // This is deliberately not the rollover above. A scheduled rollover keeps the
  // replaced key published so tokens it signed go on verifying; when the key is
  // compromised that is exactly the wrong behaviour, because a forged token
  // verifies too. So the old key leaves the set at once and the ID tokens it
  // signed stop working -- which is the point, not a side effect.
  async replaceNow(): Promise<{ minted: SigningKey; removed: string[] }> {
    const minted = await this.mint('active');
    const removed: string[] = [];
    for (const key of await this.keys.listPublished()) {
      if (key.kid !== minted.kid) {
        await this.keys.deleteByKid(key.kid);
        removed.push(key.kid);
      }
    }
    logger.warn({ kid: minted.kid, removed }, 'signing key replaced immediately');
    return { minted, removed };
  }

  // Runs the state machine one step. Called at boot and on the sweep, so a
  // rollover needs no scheduler of its own. Returns the active kid afterwards,
  // which is how the caller knows whether the provider has to be rebuilt.
  async advance(): Promise<{ activeKid: string | null; changed: boolean }> {
    const now = new Date(this.now());
    const before = await this.active();

    await this.keys.deleteRetired(now);

    const published = await this.keys.listPublished();
    const active = published.find((key) => key.state === 'active') ?? null;
    const incoming = published.find((key) => key.state === 'incoming') ?? null;

    if (!active && !incoming) {
      const first = await this.mint('active');
      logger.info({ kid: first.kid }, 'minted the first signing key');
      return { activeKid: first.kid, changed: true };
    }

    // An incoming key that has been published long enough takes over, and the
    // key it replaces starts its retirement rather than disappearing.
    if (incoming && this.publishedLongEnough(incoming, now)) {
      await this.keys.setState(incoming.kid, 'active', { activatedAt: now });
      if (active) {
        await this.keys.setState(active.kid, 'retiring', {
          retiresAt: new Date(now.getTime() + KEY_RETIRE_AFTER_MS),
        });
      }
      logger.info({ kid: incoming.kid, replaced: active?.kid }, 'promoted a signing key');
      return { activeKid: incoming.kid, changed: true };
    }

    // Time to start the next rollover.
    if (active && !incoming && this.dueForRotation(active, now)) {
      const next = await this.mint('incoming');
      logger.info({ kid: next.kid }, 'published an incoming signing key');
      return { activeKid: active.kid, changed: false };
    }

    const activeKid = active?.kid ?? incoming?.kid ?? null;
    return { activeKid, changed: activeKid !== (before?.kid ?? null) };
  }

  private publishedLongEnough(key: SigningKey, now: Date): boolean {
    return now.getTime() - key.createdAt.getTime() >= KEY_PUBLISH_LEAD_MS;
  }

  private dueForRotation(key: SigningKey, now: Date): boolean {
    const since = key.activatedAt ?? key.createdAt;
    return now.getTime() - since.getTime() >= KEY_ROTATION_INTERVAL_MS;
  }
}
