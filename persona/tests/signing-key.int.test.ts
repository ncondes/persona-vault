import { createPrivateKey, createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  ID_TOKEN_TTL_MS,
  KEY_PUBLISH_LEAD_MS,
  KEY_RETIRE_AFTER_MS,
  KEY_ROTATION_INTERVAL_MS,
} from '../src/constants/keys';
import { prisma } from '../src/infrastructure/db/prisma';
import { PrismaSigningKeyRepository } from '../src/repositories/signing-key.repository';
import { SigningKeyService } from '../src/services/signing-key.service';

// A full rollover against the real table, with the clock under the test's
// control. The claim being proved is the one that makes rotation safe rather
// than merely possible: a token signed before the rollover still verifies after
// it, right up until the retiring key leaves the published set.
//
// It signs and verifies directly rather than driving a whole authorization-code
// flow, because what is under test is the key lifecycle — the flow itself is
// covered in tests/security.int.test.ts and the acceptance suite.
type Jwk = Record<string, unknown>;

function clock(at = Date.UTC(2026, 0, 1)) {
  let now = at;
  return { now: () => now, advance: (ms: number) => { now += ms; } };
}

function signWith(jwk: Jwk, payload: object): string {
  const key = createPrivateKey({ key: jwk as never, format: 'jwk' });
  return jwt.sign(payload, key, { algorithm: 'RS256', keyid: String(jwk.kid) });
}

// What a relying party does: read the kid out of the header, find that key in
// the published set, verify against it. `at` is the verifier's clock, on the
// same timeline as the signer's, so the test is about the key lifecycle and not
// about the token having aged out.
function verifyAgainst(published: Jwk[], token: string, at: number): object | null {
  const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()) as {
    kid: string;
  };
  const jwk = published.find((key) => key.kid === header.kid);
  if (!jwk) return null;
  const key = createPublicKey({ key: jwk as never, format: 'jwk' });
  return jwt.verify(token, key, {
    algorithms: ['RS256'],
    clockTimestamp: Math.floor(at / 1000),
  }) as object;
}

describe('signing key rotation (integration)', () => {
  const time = clock();
  // Every kid this test creates, so it can take its own rows out again without
  // touching whatever else the database holds.
  const minted: string[] = [];
  const service = new SigningKeyService(
    new PrismaSigningKeyRepository(prisma as never),
    time.now,
  );

  afterAll(async () => {
    await prisma.signingKey.deleteMany({ where: { kid: { in: minted } } });
    await prisma.$disconnect();
  });

  it('rolls a key over without breaking a token signed before it', async () => {
    // Whatever this database already holds is irrelevant, so the test tracks
    // only the keys it mints itself.
    const before = await prisma.signingKey.findMany({ select: { kid: true } });
    const existing = new Set(before.map((k) => k.kid));
    const mine = async (): Promise<Jwk[]> =>
      (await service.jwks()).keys.filter((k) => !existing.has(String(k.kid)));
    const track = async () => {
      for (const key of await mine()) {
        if (!minted.includes(String(key.kid))) minted.push(String(key.kid));
      }
    };

    // 1. One key, signing.
    const first = await service.mint('active');
    await track();
    expect((await service.active())!.kid).toBe(first.kid);

    // 2. Ninety days on, the rollover starts: a new key is published but signs
    //    nothing yet, so a verifier has seen it before it ever meets a token
    //    under that kid.
    time.advance(KEY_ROTATION_INTERVAL_MS);
    await service.advance();
    await track();
    expect(await mine()).toHaveLength(2);
    expect((await service.active())!.kid).toBe(first.kid);

    // 3. A token issued in the last moments before the handover. This is the
    //    one rotation has to not break — anything older has expired by itself.
    time.advance(KEY_PUBLISH_LEAD_MS);
    const signingKey = (await mine()).find((k) => k.kid === first.kid)!;
    const issuedAt = time.now();
    const token = signWith(signingKey, {
      sub: 'user-1',
      iat: Math.floor(issuedAt / 1000),
      exp: Math.floor((issuedAt + ID_TOKEN_TTL_MS) / 1000),
    });
    expect(verifyAgainst(await mine(), token, issuedAt)).toMatchObject({ sub: 'user-1' });

    // 4. The handover. The new key signs; the old one is published for
    //    verification only.
    await service.advance();
    const promoted = (await service.active())!;
    expect(promoted.kid).not.toBe(first.kid);
    expect(String((await mine())[0].kid)).toBe(promoted.kid);

    // The point of the whole exercise.
    expect(verifyAgainst(await mine(), token, issuedAt + 60_000)).toMatchObject({
      sub: 'user-1',
    });

    // 5. Once every token the old key signed has expired, it leaves the set —
    //    and that token stops verifying, which is correct rather than a
    //    regression.
    time.advance(KEY_RETIRE_AFTER_MS + 1000);
    await service.advance();
    expect((await mine()).map((k) => k.kid)).not.toContain(first.kid);
    expect(verifyAgainst(await mine(), token, time.now())).toBeNull();
  });

  it('survives a restart, because the keys are in the database not the process', async () => {
    const restarted = new SigningKeyService(
      new PrismaSigningKeyRepository(prisma as never),
      time.now,
    );
    const active = await restarted.active();
    expect(active).not.toBeNull();
    expect((await restarted.jwks()).keys.length).toBeGreaterThan(0);
  });
});
