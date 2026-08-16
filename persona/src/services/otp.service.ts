import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from '../constants/otp';
import { Mailer } from '../domain/interfaces/mailer';
import { OtpChallengeRepository } from '../domain/interfaces/otp-challenge.repository';
import { AppError, TooManyRequestsError, UnauthorizedError } from '../domain/errors';
import { OtpChallenge } from '../domain/models';
import { generateOtp, hashOtp, otpMatches } from '../infrastructure/auth/otp';
import { logger } from '../infrastructure/logger/logger';
import { renderOtpEmail } from '../infrastructure/mail/otp-email';

// What a caller brings. The code and the expiry are this service's business, so
// they are not in here.
export type IssueInput =
  | { purpose: 'signup'; email: string; firstName: string; lastName: string; passwordHash: string }
  | { purpose: 'login'; email: string; userId: string };

// What the client gets back when a code goes out. The code is not in it: the
// only way to learn it is to open the inbox it was sent to, which is the point.
export interface IssuedChallenge {
  challengeId: string;
  email: string;
  expiresAt: Date;
}

// The exception to that rule, for development only: the code comes back in the
// clear so a flow gated on an inbox can be driven without one. The route that
// exposes this is not mounted when the app runs in production.
export interface DevChallenge {
  challengeId: string;
  code: string;
  expiresAt: Date;
}

export interface OtpService {
  issue(input: IssueInput): Promise<IssuedChallenge>;
  issueForDev(input: IssueInput): Promise<DevChallenge>;
  verify(challengeId: string, code: string): Promise<OtpChallenge>;
  resend(challengeId: string): Promise<IssuedChallenge>;
  consume(challengeId: string): Promise<void>;
}

function issued(challenge: OtpChallenge): IssuedChallenge {
  return {
    challengeId: challenge.id,
    email: challenge.email,
    expiresAt: challenge.expiresAt,
  };
}

export class OtpServiceImpl implements OtpService {
  constructor(
    private readonly challenges: OtpChallengeRepository,
    private readonly mailer: Mailer,
  ) {}

  // A challenge already in flight is handed straight back, untouched: no second
  // email, and no chance to change the details parked behind it.
  //
  // Both halves of that matter. Not sending is what stops a script using sign-up
  // to post mail to a stranger's inbox — one email per address per cycle, and
  // resending is the only way to ask for more. Not touching the details is what
  // stops someone who knows an address from re-posting a sign-up with their own
  // password while the real person's code is in flight, and having that person
  // unwittingly finish an account the attacker can log into.
  //
  // The cost is that a sign-up typed with the wrong password cannot be corrected
  // until the challenge expires. Ten minutes of waiting beats either hole.
  async issue(input: IssueInput): Promise<IssuedChallenge> {
    const live = await this.challenges.findLive(input.email, input.purpose);
    if (live) return issued(live);

    const code = generateOtp();
    const challenge = await this.challenges.create({
      ...input,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    return this.deliver(
      challenge,
      code,
      input.purpose === 'signup' ? input.firstName : null,
    );
  }

  // Mints a fresh challenge and hands its code straight back instead of emailing
  // it. Any live one is dropped first so the returned code is the valid one.
  // Development only — the caller (a route mounted only outside production) is
  // what keeps this off a real deployment.
  async issueForDev(input: IssueInput): Promise<DevChallenge> {
    const live = await this.challenges.findLive(input.email, input.purpose);
    if (live) await this.challenges.deleteById(live.id);

    const code = generateOtp();
    const challenge = await this.challenges.create({
      ...input,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    return { challengeId: challenge.id, code, expiresAt: challenge.expiresAt };
  }

  // The one way to make a second email happen, and the only place the cooldown
  // and the send cap are felt — because here somebody asked, and deserves to be
  // told why nothing arrived.
  async resend(challengeId: string): Promise<IssuedChallenge> {
    const existing = await this.find(challengeId);
    await this.rejectIfExpired(existing);

    const { challenge, code } = await this.reissue(existing);
    return this.deliver(challenge, code, challenge.firstName);
  }

  // A wrong code costs an attempt; running out burns the challenge, so the next
  // guess has nothing left to guess at.
  async verify(challengeId: string, code: string): Promise<OtpChallenge> {
    const challenge = await this.find(challengeId);
    await this.rejectIfExpired(challenge);

    if (!otpMatches(code, challenge.codeHash)) {
      const after = await this.challenges.recordAttempt(challenge.id);
      if (after.attempts >= OTP_MAX_ATTEMPTS) {
        await this.challenges.deleteById(challenge.id);
        throw new UnauthorizedError(
          'Too many wrong codes. Start again to get a new one.',
          'OTP_TOO_MANY_ATTEMPTS',
        );
      }
      throw new UnauthorizedError('That code is not right', 'OTP_INVALID');
    }

    return challenge;
  }

  consume(challengeId: string): Promise<void> {
    return this.challenges.deleteById(challengeId);
  }

  private async find(challengeId: string): Promise<OtpChallenge> {
    const challenge = await this.challenges.findById(challengeId);
    if (!challenge) {
      throw new UnauthorizedError('That code has expired', 'CHALLENGE_NOT_FOUND');
    }
    return challenge;
  }

  private async rejectIfExpired(challenge: OtpChallenge): Promise<void> {
    if (challenge.expiresAt.getTime() > Date.now()) return;
    await this.challenges.deleteById(challenge.id);
    throw new UnauthorizedError('That code has expired', 'OTP_EXPIRED');
  }

  // Replaces the code on a challenge that is still in flight, subject to the
  // cooldown and the send cap.
  private async reissue(
    challenge: OtpChallenge,
  ): Promise<{ challenge: OtpChallenge; code: string }> {
    const waited = Date.now() - challenge.lastSentAt.getTime();
    if (waited < OTP_RESEND_COOLDOWN_MS) {
      const seconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - waited) / 1000);
      throw new TooManyRequestsError(
        `Wait ${seconds} seconds before asking for another code`,
        'OTP_RESEND_TOO_SOON',
      );
    }
    if (challenge.sends >= OTP_MAX_SENDS) {
      throw new TooManyRequestsError(
        'Too many codes sent to that address. Try again later.',
        'OTP_SEND_LIMIT',
      );
    }

    const code = generateOtp();
    const updated = await this.challenges.reissue(challenge.id, {
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    return { challenge: updated, code };
  }

  // If the mail does not go out there is no way to finish, so the challenge is
  // cleared rather than left holding a cooldown against a code nobody received.
  private async deliver(
    challenge: OtpChallenge,
    code: string,
    firstName: string | null,
  ): Promise<IssuedChallenge> {
    const mail = renderOtpEmail({ code, purpose: challenge.purpose, firstName });
    try {
      await this.mailer.send({ to: challenge.email, ...mail });
    } catch (err) {
      logger.error({ err, challengeId: challenge.id }, 'failed to send an otp email');
      await this.challenges.deleteById(challenge.id);
      throw new AppError(502, 'EMAIL_SEND_FAILED', 'We could not send the code. Please try again.');
    }
    return issued(challenge);
  }
}
