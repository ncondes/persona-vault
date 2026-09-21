import { createPrivateKey } from 'node:crypto';
import {
  ID_TOKEN_TTL_MS,
  KEY_PUBLISH_LEAD_MS,
  KEY_RETIRE_AFTER_MS,
  KEY_ROTATION_INTERVAL_MS,
} from '../src/constants/keys';
import { SigningKeyService, publicMembersOf, thumbprint } from '../src/services/signing-key.service';
import { FakeSigningKeys } from './support/fakes';

// The rollover, driven by a clock the test moves. The property being checked
// throughout is the one that makes rotation safe: a key is published before it
// signs anything, and stays published until every token it signed has expired.
function clock(at = Date.UTC(2026, 0, 1)) {
  let now = at;
  return { now: () => now, advance: (ms: number) => { now += ms; } };
}

function build() {
  const time = clock();
  const keys = new FakeSigningKeys();
  return { time, keys, service: new SigningKeyService(keys, time.now) };
}

describe('thumbprint', () => {
  // RFC 7638: the hash covers e, kty and n in lexical order, so the same key
  // always yields the same id whoever computes it.
  it('is stable for the same key and ignores the other members', () => {
    const jwk = { kty: 'RSA', n: 'abc', e: 'AQAB' };
    expect(thumbprint(jwk)).toBe(thumbprint({ ...jwk, use: 'sig', alg: 'RS256', kid: 'ignored' }));
  });

  it('differs for different keys', () => {
    expect(thumbprint({ kty: 'RSA', n: 'abc', e: 'AQAB' })).not.toBe(
      thumbprint({ kty: 'RSA', n: 'xyz', e: 'AQAB' }),
    );
  });
});

describe('publicMembersOf', () => {
  it('strips every private member and keeps the rest', () => {
    const stripped = publicMembersOf({
      kty: 'RSA', n: 'n', e: 'e', kid: 'k', alg: 'RS256', use: 'sig',
      d: 'd', p: 'p', q: 'q', dp: 'dp', dq: 'dq', qi: 'qi',
    });
    expect(Object.keys(stripped).sort()).toEqual(['alg', 'e', 'kid', 'kty', 'n', 'use']);
  });
});

describe('SigningKeyService', () => {
  it('mints the first key active when there is nothing to roll over from', async () => {
    const { service, keys } = build();
    const { activeKid, changed } = await service.advance();

    expect(changed).toBe(true);
    expect(keys.rows).toHaveLength(1);
    expect(keys.rows[0].state).toBe('active');
    expect(keys.rows[0].kid).toBe(activeKid);
  });

  it('derives the kid from the key rather than naming it', async () => {
    const { service } = build();
    const key = await service.mint('active');
    expect(key.kid).toBe(thumbprint(key.publicJwk as Record<string, unknown>));
    // The old code hardcoded this in every checkout, so two different keys
    // collided on one id.
    expect(key.kid).not.toBe('persona-dev-1');
  });

  it('never publishes private key material', async () => {
    const { service, keys } = build();
    await service.mint('active');
    expect(Object.keys(keys.rows[0].publicJwk as object)).not.toContain('d');
  });

  it('hands the provider a usable private key', async () => {
    const { service } = build();
    await service.mint('active');
    const { keys } = await service.jwks();
    // If this throws, the provider could not sign with it either.
    expect(() => createPrivateKey({ key: keys[0] as never, format: 'jwk' })).not.toThrow();
  });

  describe('a rollover', () => {
    it('publishes the incoming key before it signs anything', async () => {
      const { service, time } = build();
      await service.advance();
      const first = (await service.active())!.kid;

      time.advance(KEY_ROTATION_INTERVAL_MS);
      await service.advance();

      const published = await service.jwks();
      expect(published.keys).toHaveLength(2);
      // Still the old key at the front, so it is still the one that signs.
      expect((await service.active())!.kid).toBe(first);
    });

    it('promotes the incoming key only after the publish lead', async () => {
      const { service, time } = build();
      await service.advance();
      const first = (await service.active())!.kid;

      time.advance(KEY_ROTATION_INTERVAL_MS);
      await service.advance();

      time.advance(KEY_PUBLISH_LEAD_MS - 1000);
      await service.advance();
      expect((await service.active())!.kid).toBe(first);

      time.advance(2000);
      await service.advance();
      expect((await service.active())!.kid).not.toBe(first);
    });

    it('keeps the replaced key published so tokens it signed still verify', async () => {
      const { service, time, keys } = build();
      await service.advance();
      const first = (await service.active())!.kid;

      time.advance(KEY_ROTATION_INTERVAL_MS);
      await service.advance();
      time.advance(KEY_PUBLISH_LEAD_MS);
      await service.advance();

      const retiring = keys.rows.find((key) => key.kid === first)!;
      expect(retiring.state).toBe('retiring');
      expect((await service.jwks()).keys.map((k) => k.kid)).toContain(first);
    });

    // The window has to outlast the longest-lived thing the key signed. Only the
    // ID token is signed here, so it is an hour plus tolerance plus cache margin
    // — not the fourteen days a session lasts.
    it('sets the retirement past the lifetime of anything it signed', async () => {
      const { service, time, keys } = build();
      await service.advance();
      const first = (await service.active())!.kid;

      time.advance(KEY_ROTATION_INTERVAL_MS);
      await service.advance();
      time.advance(KEY_PUBLISH_LEAD_MS);
      await service.advance();

      const retiring = keys.rows.find((key) => key.kid === first)!;
      const window = retiring.retiresAt!.getTime() - time.now();
      expect(window).toBe(KEY_RETIRE_AFTER_MS);
      expect(window).toBeGreaterThan(ID_TOKEN_TTL_MS);
    });

    it('drops the old key once its window has passed', async () => {
      const { service, time } = build();
      await service.advance();
      const first = (await service.active())!.kid;

      time.advance(KEY_ROTATION_INTERVAL_MS);
      await service.advance();
      time.advance(KEY_PUBLISH_LEAD_MS);
      await service.advance();

      time.advance(KEY_RETIRE_AFTER_MS + 1000);
      await service.advance();

      const published = await service.jwks();
      expect(published.keys.map((k) => k.kid)).not.toContain(first);
      expect(published.keys).toHaveLength(1);
    });

    it('does not start a rollover before the interval is up', async () => {
      const { service, time, keys } = build();
      await service.advance();

      time.advance(KEY_ROTATION_INTERVAL_MS - 1000);
      await service.advance();

      expect(keys.rows).toHaveLength(1);
    });

    it('orders the set active first, so the right key signs', async () => {
      const { service, time } = build();
      await service.advance();
      time.advance(KEY_ROTATION_INTERVAL_MS);
      await service.advance();

      const active = (await service.active())!.kid;
      expect((await service.jwks()).keys[0].kid).toBe(active);
    });
  });

  describe('adopting a key that already exists', () => {
    // Tokens already in flight carry the old id in their header. Recomputing it
    // would make every one of them unverifiable until it expired.
    it('keeps the kid exactly as it was', async () => {
      const { service } = build();
      const adopted = await service.adopt({
        kty: 'RSA', n: 'abc', e: 'AQAB', d: 'secret', kid: 'persona-dev-1',
      });
      expect(adopted.kid).toBe('persona-dev-1');
      expect(adopted.state).toBe('active');
    });

    it('computes one only when the key set carried none', async () => {
      const { service } = build();
      const jwk = { kty: 'RSA', n: 'abc', e: 'AQAB', d: 'secret' };
      expect((await service.adopt(jwk)).kid).toBe(thumbprint(jwk));
    });

    it('does not publish the private half of an adopted key', async () => {
      const { service, keys } = build();
      await service.adopt({ kty: 'RSA', n: 'abc', e: 'AQAB', d: 'secret', kid: 'k' });
      expect(Object.keys(keys.rows[0].publicJwk as object)).not.toContain('d');
      // But the provider still gets it, or it could not sign.
      expect((await service.jwks()).keys[0].d).toBe('secret');
    });
  });
});
