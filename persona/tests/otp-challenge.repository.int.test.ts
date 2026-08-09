import { OtpChallengeRepository } from '../src/domain/interfaces/otp-challenge.repository';
import { OtpChallenge } from '../src/domain/models';
import { prisma } from '../src/infrastructure/db/prisma';
import { PrismaOtpChallengeRepository } from '../src/repositories/otp-challenge.repository';
import { FakeOtpChallenges } from './support/fakes';

// The table that holds a sign-up or sign-in while it waits for its emailed code.
// The auth flows cover the happy paths; this covers what they never reach —
// expiry, the resend counters, the sweep, and the login row's foreign key.
describe('otp challenge repository (integration)', () => {
  const repo = new PrismaOtpChallengeRepository(prisma);
  const stamp = Date.now();
  const prefix = `otp-int-${stamp}`;

  const past = () => new Date(Date.now() - 60_000);
  const future = () => new Date(Date.now() + 60_000);

  const signup = (email: string, codeHash = 'hash-a') =>
    ({
      purpose: 'signup',
      email,
      firstName: 'Ada',
      lastName: 'Lovelace',
      passwordHash: 'bcrypt-hash',
      codeHash,
      expiresAt: future(),
    }) as const;

  afterAll(async () => {
    await prisma.otpChallenge.deleteMany({ where: { email: { startsWith: 'otp-int-' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'otp-int-' } } });
    await prisma.$disconnect();
  });

  it('stores a sign-up in full and finds it again', async () => {
    const email = `${prefix}-store@example.com`;
    const created = await repo.create(signup(email));

    expect(created).toMatchObject({
      purpose: 'signup',
      email,
      firstName: 'Ada',
      lastName: 'Lovelace',
      passwordHash: 'bcrypt-hash',
      codeHash: 'hash-a',
      userId: null,
      attempts: 0,
      sends: 1,
    });

    expect(await repo.findById(created.id)).toMatchObject({ id: created.id, email });
    expect(await repo.findById('no-such-challenge')).toBeNull();
  });

  // A login challenge points at a real account, and the cascade means deleting
  // the account takes its pending sign-ins with it.
  it('ties a sign-in challenge to its user and dies with it', async () => {
    const email = `${prefix}-login@example.com`;
    const user = await prisma.user.create({ data: { email, passwordHash: 'x' } });

    const created = await repo.create({
      purpose: 'login',
      email,
      userId: user.id,
      codeHash: 'hash-b',
      expiresAt: future(),
    });

    expect(created).toMatchObject({
      purpose: 'login',
      userId: user.id,
      firstName: null,
      lastName: null,
      passwordHash: null,
    });

    await prisma.user.delete({ where: { id: user.id } });
    expect(await repo.findById(created.id)).toBeNull();
  });

  it('finds only the live challenge for an address and flow', async () => {
    const email = `${prefix}-live@example.com`;
    await repo.create({ ...signup(email), expiresAt: past() });

    expect(await repo.findLive(email, 'signup')).toBeNull();

    const live = await repo.create(signup(email));

    expect(await repo.findLive(email, 'signup')).toMatchObject({ id: live.id });
    // Same address, other flow: a pending sign-up must not answer for a sign-in.
    expect(await repo.findLive(email, 'login')).toBeNull();
  });

  // Called only from the 15-minute sweep in src/index.ts, so nothing else
  // exercises it.
  it('deleteExpired clears past challenges and leaves live ones', async () => {
    const dead = await repo.create({
      ...signup(`${prefix}-sweep-dead@example.com`),
      expiresAt: past(),
    });
    const alive = await repo.create(signup(`${prefix}-sweep-alive@example.com`));

    const removed = await repo.deleteExpired();

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await repo.findById(dead.id)).toBeNull();
    expect(await repo.findById(alive.id)).not.toBeNull();
  });

  // The unit tests for the OTP service run against an in-memory fake. If the fake
  // and the real repository disagree, those tests are proving nothing — so run the
  // same script of operations through both and compare every answer.
  describe('the in-memory fake behaves like the real repository', () => {
    // Ids and timestamps differ by construction; everything else must match.
    function shape(row: OtpChallenge | null, runPrefix: string): unknown {
      if (!row) return null;
      return {
        purpose: row.purpose,
        email: row.email.replace(runPrefix, '<run>'),
        userId: row.userId,
        firstName: row.firstName,
        lastName: row.lastName,
        passwordHash: row.passwordHash,
        codeHash: row.codeHash,
        attempts: row.attempts,
        sends: row.sends,
        expired: row.expiresAt.getTime() < Date.now(),
      };
    }

    async function script(store: OtpChallengeRepository, runPrefix: string) {
      const seen: unknown[] = [];
      const see = (row: OtpChallenge | null) => seen.push(shape(row, runPrefix));

      const email = `${runPrefix}-a@example.com`;
      const created = await store.create({
        purpose: 'signup',
        email,
        firstName: 'Ada',
        lastName: 'Lovelace',
        passwordHash: 'bcrypt-hash',
        codeHash: 'hash-1',
        expiresAt: future(),
      });
      see(created);
      see(await store.findById(created.id));
      see(await store.findById('absent'));
      see(await store.findLive(email, 'signup'));
      see(await store.findLive(email, 'login'));
      see(await store.findLive(`${runPrefix}-other@example.com`, 'signup'));

      see(await store.recordAttempt(created.id));
      see(await store.recordAttempt(created.id));

      // A resend replaces the code, clears the attempts and counts the send.
      see(await store.reissue(created.id, { codeHash: 'hash-2', expiresAt: future() }));

      const stale = await store.create({
        purpose: 'signup',
        email: `${runPrefix}-stale@example.com`,
        firstName: 'Alan',
        lastName: 'Turing',
        passwordHash: 'bcrypt-hash-3',
        codeHash: 'hash-3',
        expiresAt: past(),
      });
      see(await store.findLive(`${runPrefix}-stale@example.com`, 'signup'));

      await store.deleteExpired();
      see(await store.findById(stale.id));
      see(await store.findById(created.id));

      // Deleting twice is not an error: a burnt code and a completed sign-up
      // both try to clear the same row.
      await store.deleteById(created.id);
      await store.deleteById(created.id);
      see(await store.findById(created.id));

      return seen;
    }

    it('gives the same answers to the same operations', async () => {
      const real = await script(repo, `${prefix}-real`);
      const fake = await script(new FakeOtpChallenges(), `${prefix}-fake`);

      expect(fake).toEqual(real);
    });
  });
});
