import { CreateVaultItemInput } from '../src/domain/interfaces/vault.repository';
import { Repositories, UnitOfWork } from '../src/domain/interfaces/unit-of-work';
import { AuthServiceImpl } from '../src/services/auth.service';
import { OtpServiceImpl } from '../src/services/otp.service';
import { EmailMessage, Mailer } from '../src/domain/interfaces/mailer';
import { FakeOtpChallenges, FakeUsers, errorFrom } from './support/fakes';

// The service depends on interfaces, not on Prisma, so in-memory fakes are
// enough. No database needed for these tests.
function makeService() {
  const users = new FakeUsers();
  // A recording stub rather than FakeVault: these tests assert on the exact
  // input the service passes, not on what ends up stored.
  const created: CreateVaultItemInput[] = [];
  const repos = {
    users,
    vault: {
      create: async (input: CreateVaultItemInput) => {
        created.push(input);
        return input as never;
      },
    },
  } as unknown as Repositories;
  const unitOfWork: UnitOfWork = { run: (work) => work(repos) };

  // The real OTP service over a fake store and a mailer that keeps the message
  // instead of sending it — the code has to come from somewhere, and reading it
  // out of the "inbox" is what a person does.
  const challenges = new FakeOtpChallenges();
  const sent: EmailMessage[] = [];
  const mailer: Mailer = { send: async (message) => void sent.push(message) };
  const otp = new OtpServiceImpl(challenges, mailer);

  const lastCode = () => sent.at(-1)!.subject.slice(0, 6);
  return {
    service: new AuthServiceImpl(users, unitOfWork, otp),
    users,
    created,
    challenges,
    sent,
    lastCode,
  };
}

// The whole flow, for the tests that are about what happens afterwards.
async function registerVerified(
  harness: ReturnType<typeof makeService>,
  email = 'a@example.com',
  password = 'password123',
) {
  const issued = await harness.service.startRegistration('Ada', 'Lovelace', email, password);
  return harness.service.completeRegistration(issued.challengeId, harness.lastCode());
}

describe('AuthService', () => {
  describe('registration', () => {
    // The reason the feature exists: an address nobody reads never becomes a row.
    it('creates nothing until the code comes back', async () => {
      const harness = makeService();

      await harness.service.startRegistration('Ada', 'Lovelace', 'a@example.com', 'password123');

      expect(harness.users.rows).toHaveLength(0);
      expect(harness.created).toHaveLength(0);
      expect(harness.sent).toHaveLength(1);
    });

    it('parks the password as a hash, never as typed', async () => {
      const harness = makeService();

      await harness.service.startRegistration('Ada', 'Lovelace', 'a@example.com', 'password123');

      expect(harness.challenges.rows[0].passwordHash).not.toBe('password123');
      expect(harness.challenges.rows[0].passwordHash).toBeTruthy();
    });

    it('creates the user and starts the vault once the code is right', async () => {
      const harness = makeService();

      const user = await registerVerified(harness);

      expect(user.email).toBe('a@example.com');
      expect(user.passwordHash).not.toBe('password123');
      expect(harness.created).toHaveLength(2);
      expect(harness.created[0]).toMatchObject({
        kind: 'name',
        value: 'Ada Lovelace',
        detail: { firstName: 'Ada', lastName: 'Lovelace' },
        isDefault: true,
      });
      expect(harness.created[1]).toMatchObject({
        kind: 'email',
        value: 'a@example.com',
        isDefault: true,
      });
      // The challenge is spent, so the same code cannot be replayed.
      expect(harness.challenges.rows).toHaveLength(0);
    });

    it('creates nothing when the code is wrong', async () => {
      const harness = makeService();
      const issued = await harness.service.startRegistration(
        'Ada',
        'Lovelace',
        'a@example.com',
        'password123',
      );
      const wrong = harness.lastCode() === '000000' ? '111111' : '000000';

      await errorFrom(harness.service.completeRegistration(issued.challengeId, wrong));

      expect(harness.users.rows).toHaveLength(0);
      expect(harness.created).toHaveLength(0);
    });

    // Pressing sign-up twice must not mean two emails, and must not let a
    // second caller change what is parked behind the first one's code.
    it('leaves a sign-up already in flight exactly as it was', async () => {
      const harness = makeService();
      const first = await harness.service.startRegistration(
        'Ada',
        'Lovelace',
        'a@example.com',
        'password123',
      );

      const second = await harness.service.startRegistration(
        'Mallory',
        'Attacker',
        'a@example.com',
        'not-their-password',
      );

      expect(second.challengeId).toBe(first.challengeId);
      expect(harness.sent).toHaveLength(1);
      expect(harness.challenges.rows[0].firstName).toBe('Ada');

      // And finishing it creates the account the first caller asked for.
      const user = await harness.service.completeRegistration(
        first.challengeId,
        harness.lastCode(),
      );
      expect(user.email).toBe('a@example.com');
      expect(harness.created[0]).toMatchObject({ value: 'Ada Lovelace' });
    });

    it('rejects a duplicate before any code is sent', async () => {
      const harness = makeService();
      await registerVerified(harness, 'dup@example.com');

      const err = await errorFrom<{ code: string }>(
        harness.service.startRegistration('Dup', 'User', 'dup@example.com', 'password123'),
      );

      expect(err.code).toBe('EMAIL_TAKEN');
      expect(harness.sent).toHaveLength(1);
    });

    // Ten minutes is long enough for someone else to claim the address while
    // the first code sits unread.
    it('rejects a duplicate that appeared while the code was in flight', async () => {
      const harness = makeService();
      const issued = await harness.service.startRegistration(
        'Ada',
        'Lovelace',
        'race@example.com',
        'password123',
      );
      await harness.users.create({ email: 'race@example.com', passwordHash: 'someone-else' });

      const err = await errorFrom<{ code: string }>(
        harness.service.completeRegistration(issued.challengeId, harness.lastCode()),
      );

      expect(err.code).toBe('EMAIL_TAKEN');
      expect(harness.created).toHaveLength(0);
    });

    // One table holds both flows, so the endpoints must not accept each other's
    // challenges.
    it('will not finish a sign-up with a sign-in code', async () => {
      const harness = makeService();
      await registerVerified(harness, 'ada@example.com');
      const issued = await harness.service.startLogin('ada@example.com', 'password123');

      const err = await errorFrom<{ code: string }>(
        harness.service.completeRegistration(issued.challengeId, harness.lastCode()),
      );

      expect(err.code).toBe('CHALLENGE_NOT_FOUND');
    });
  });

  describe('login', () => {
    it('sends a code once the password checks out, and no session yet', async () => {
      const harness = makeService();
      await registerVerified(harness);
      const before = harness.sent.length;

      const issued = await harness.service.startLogin('a@example.com', 'password123');

      expect(issued.challengeId).toBeTruthy();
      expect(harness.sent).toHaveLength(before + 1);
      expect(harness.sent.at(-1)!.to).toBe('a@example.com');
    });

    it('returns the user once the code is right', async () => {
      const harness = makeService();
      const registered = await registerVerified(harness);

      const issued = await harness.service.startLogin('a@example.com', 'password123');
      const user = await harness.service.completeLogin(issued.challengeId, harness.lastCode());

      expect(user.id).toBe(registered.id);
      expect(harness.challenges.rows).toHaveLength(0);
    });

    it('sends nothing when the password is wrong', async () => {
      const harness = makeService();
      await registerVerified(harness, 'b@example.com');
      const before = harness.sent.length;

      const err = await errorFrom<{ code: string }>(
        harness.service.startLogin('b@example.com', 'wrong-password'),
      );

      expect(err.code).toBe('INVALID_CREDENTIALS');
      expect(harness.sent).toHaveLength(before);
    });

    // An unknown address must not become a way to post mail to strangers.
    it('sends nothing for an unknown email', async () => {
      const harness = makeService();

      const err = await errorFrom<{ code: string }>(
        harness.service.startLogin('nobody@example.com', 'whatever'),
      );

      expect(err.code).toBe('INVALID_CREDENTIALS');
      expect(harness.sent).toHaveLength(0);
    });

    it('will not finish a sign-in with a sign-up code', async () => {
      const harness = makeService();
      const issued = await harness.service.startRegistration(
        'Ada',
        'Lovelace',
        'new@example.com',
        'password123',
      );

      const err = await errorFrom<{ code: string }>(
        harness.service.completeLogin(issued.challengeId, harness.lastCode()),
      );

      expect(err.code).toBe('CHALLENGE_NOT_FOUND');
      expect(harness.users.rows).toHaveLength(0);
    });
  });
});
