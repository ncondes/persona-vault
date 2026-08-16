import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS,
  OTP_RESEND_COOLDOWN_MS,
} from '../src/constants/otp';
import { EmailMessage, Mailer } from '../src/domain/interfaces/mailer';
import { OtpServiceImpl } from '../src/services/otp.service';
import { FakeOtpChallenges, errorFrom } from './support/fakes';

// Records what would have gone out, so a test can read the code the same way a
// person reads their inbox.
class RecordingMailer implements Mailer {
  sent: EmailMessage[] = [];
  failNext = false;

  async send(message: EmailMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('resend is down');
    }
    this.sent.push(message);
  }

  // The subject leads with the code, which is the only place a test can find it.
  get lastCode(): string {
    const subject = this.sent.at(-1)!.subject;
    return subject.slice(0, 6);
  }
}

function makeService() {
  const challenges = new FakeOtpChallenges();
  const mailer = new RecordingMailer();
  return { service: new OtpServiceImpl(challenges, mailer), challenges, mailer };
}

const signup = {
  purpose: 'signup',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  passwordHash: 'bcrypt-hash',
} as const;

// Pretends the last send happened long enough ago to ask for another.
function coolDown(challenges: FakeOtpChallenges, id: string) {
  const row = challenges.rows.find((entry) => entry.id === id)!;
  row.lastSentAt = new Date(Date.now() - OTP_RESEND_COOLDOWN_MS - 1000);
}

describe('OtpService', () => {
  describe('issuing', () => {
    it('sends a code and hands back a challenge that does not contain it', async () => {
      const { service, mailer } = makeService();

      const issued = await service.issue(signup);

      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0].to).toBe('ada@example.com');
      expect(JSON.stringify(issued)).not.toContain(mailer.lastCode);
      expect(issued.email).toBe('ada@example.com');
      expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('stores the code as a digest, never in the clear', async () => {
      const { service, challenges, mailer } = makeService();

      await service.issue(signup);

      const [row] = challenges.rows;
      expect(row.codeHash).not.toBe(mailer.lastCode);
      expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
    });

    // The whole anti-abuse story: asking again does not buy another email.
    it('hands back the live challenge instead of sending again', async () => {
      const { service, challenges, mailer } = makeService();

      const first = await service.issue(signup);
      const codeHash = challenges.rows[0].codeHash;
      coolDown(challenges, first.challengeId);
      const second = await service.issue(signup);

      expect(second.challengeId).toBe(first.challengeId);
      expect(challenges.rows).toHaveLength(1);
      expect(challenges.rows[0].sends).toBe(1);
      expect(challenges.rows[0].codeHash).toBe(codeHash);
      expect(mailer.sent).toHaveLength(1);
    });

    // Otherwise someone who knows an address could re-post a sign-up with their
    // own password while the real person's code is in flight, and have that
    // person finish an account the attacker can log into.
    it('will not let a live sign-up have different details slid in behind it', async () => {
      const { service, challenges } = makeService();

      const first = await service.issue(signup);
      coolDown(challenges, first.challengeId);
      const second = await service.issue({
        ...signup,
        firstName: 'Mallory',
        passwordHash: 'attacker-hash',
      });

      expect(second.challengeId).toBe(first.challengeId);
      expect(challenges.rows[0]).toMatchObject({
        firstName: 'Ada',
        passwordHash: 'bcrypt-hash',
      });
    });

    it('keeps a sign-up and a sign-in for one address apart', async () => {
      const { service, challenges } = makeService();

      await service.issue(signup);
      await service.issue({ purpose: 'login', email: 'ada@example.com', userId: 'user-1' });

      expect(challenges.rows).toHaveLength(2);
    });

    // Otherwise the caller is stuck behind a cooldown waiting on a code that was
    // never sent.
    it('clears the challenge when the email cannot be sent', async () => {
      const { service, challenges, mailer } = makeService();
      mailer.failNext = true;

      const err = await errorFrom<{ code: string; statusCode: number }>(service.issue(signup));

      expect(err.code).toBe('EMAIL_SEND_FAILED');
      expect(err.statusCode).toBe(502);
      expect(challenges.rows).toHaveLength(0);
    });
  });

  // The development-only path: the code comes back in the clear, no email is
  // sent, and it still passes verify().
  describe('issuing for development', () => {
    const login = { purpose: 'login', email: 'ada@example.com', userId: 'user-1' } as const;

    it('hands back a code that verify() accepts, without sending mail', async () => {
      const { service, mailer } = makeService();

      const dev = await service.issueForDev(login);

      expect(mailer.sent).toHaveLength(0);
      expect(dev.code).toMatch(/^\d{6}$/);
      const challenge = await service.verify(dev.challengeId, dev.code);
      expect(challenge.id).toBe(dev.challengeId);
      expect(challenge.userId).toBe('user-1');
    });

    it('replaces any live challenge so the returned code is the valid one', async () => {
      const { service, challenges } = makeService();

      const first = await service.issue(login);
      const second = await service.issueForDev(login);

      expect(second.challengeId).not.toBe(first.challengeId);
      expect(challenges.rows).toHaveLength(1);
      await expect(service.verify(second.challengeId, second.code)).resolves.toBeDefined();
    });
  });

  describe('verifying', () => {
    it('accepts the code that was sent', async () => {
      const { service, mailer } = makeService();
      const issued = await service.issue(signup);

      const challenge = await service.verify(issued.challengeId, mailer.lastCode);

      expect(challenge.id).toBe(issued.challengeId);
      expect(challenge.firstName).toBe('Ada');
    });

    it('rejects a wrong code and counts the attempt', async () => {
      const { service, challenges, mailer } = makeService();
      const issued = await service.issue(signup);
      const wrong = mailer.lastCode === '000000' ? '111111' : '000000';

      const err = await errorFrom<{ code: string }>(service.verify(issued.challengeId, wrong));

      expect(err.code).toBe('OTP_INVALID');
      expect(challenges.rows[0].attempts).toBe(1);
    });

    it(`burns the challenge after ${OTP_MAX_ATTEMPTS} wrong codes`, async () => {
      const { service, challenges, mailer } = makeService();
      const issued = await service.issue(signup);
      const wrong = mailer.lastCode === '000000' ? '111111' : '000000';

      for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i += 1) {
        await errorFrom(service.verify(issued.challengeId, wrong));
      }
      const last = await errorFrom<{ code: string }>(service.verify(issued.challengeId, wrong));

      expect(last.code).toBe('OTP_TOO_MANY_ATTEMPTS');
      expect(challenges.rows).toHaveLength(0);

      // And the right code no longer helps.
      const after = await errorFrom<{ code: string }>(
        service.verify(issued.challengeId, mailer.lastCode),
      );
      expect(after.code).toBe('CHALLENGE_NOT_FOUND');
    });

    it('refuses an expired code and clears it away', async () => {
      const { service, challenges, mailer } = makeService();
      const issued = await service.issue(signup);
      challenges.rows[0].expiresAt = new Date(Date.now() - 1000);

      const err = await errorFrom<{ code: string }>(
        service.verify(issued.challengeId, mailer.lastCode),
      );

      expect(err.code).toBe('OTP_EXPIRED');
      expect(challenges.rows).toHaveLength(0);
    });

    it('answers the same way for a challenge that never existed', async () => {
      const { service } = makeService();

      const err = await errorFrom<{ code: string; statusCode: number }>(
        service.verify('no-such-challenge', '123456'),
      );

      expect(err.code).toBe('CHALLENGE_NOT_FOUND');
      expect(err.statusCode).toBe(401);
    });
  });

  describe('resending', () => {
    it('sends a different code and resets the attempts', async () => {
      const { service, challenges, mailer } = makeService();
      const issued = await service.issue(signup);
      const original = mailer.lastCode;
      await errorFrom(service.verify(issued.challengeId, original === '000000' ? '1' : '000000'));
      coolDown(challenges, issued.challengeId);

      await service.resend(issued.challengeId);

      expect(challenges.rows[0].attempts).toBe(0);
      expect(challenges.rows[0].codeHash).not.toBe(original);
      // The old code stops working the moment a new one goes out.
      const err = await errorFrom<{ code: string }>(service.verify(issued.challengeId, original));
      expect(err.code).toBe('OTP_INVALID');
    });

    it('refuses to resend inside the cooldown', async () => {
      const { service, mailer } = makeService();
      const issued = await service.issue(signup);

      const err = await errorFrom<{ code: string; statusCode: number }>(
        service.resend(issued.challengeId),
      );

      expect(err.code).toBe('OTP_RESEND_TOO_SOON');
      expect(err.statusCode).toBe(429);
      expect(mailer.sent).toHaveLength(1);
    });

    it(`stops after ${OTP_MAX_SENDS} sends to the same address`, async () => {
      const { service, challenges, mailer } = makeService();
      const issued = await service.issue(signup);

      for (let i = 1; i < OTP_MAX_SENDS; i += 1) {
        coolDown(challenges, issued.challengeId);
        await service.resend(issued.challengeId);
      }
      coolDown(challenges, issued.challengeId);
      const err = await errorFrom<{ code: string }>(service.resend(issued.challengeId));

      expect(err.code).toBe('OTP_SEND_LIMIT');
      expect(mailer.sent).toHaveLength(OTP_MAX_SENDS);
      // The front door is not a way around it: it sends nothing at all.
      await service.issue(signup);
      expect(mailer.sent).toHaveLength(OTP_MAX_SENDS);
    });

    it('will not resend an expired challenge', async () => {
      const { service, challenges } = makeService();
      const issued = await service.issue(signup);
      challenges.rows[0].expiresAt = new Date(Date.now() - 1000);

      const err = await errorFrom<{ code: string }>(service.resend(issued.challengeId));

      expect(err.code).toBe('OTP_EXPIRED');
    });
  });

  it('consume removes the challenge, and twice is not an error', async () => {
    const { service, challenges } = makeService();
    const issued = await service.issue(signup);

    await service.consume(issued.challengeId);
    await service.consume(issued.challengeId);

    expect(challenges.rows).toHaveLength(0);
  });
});
