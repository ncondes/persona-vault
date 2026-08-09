import { OtpChallenge, OtpPurpose } from '../models';

// A discriminated union rather than one interface with six optional fields: the
// two purposes need different columns, and this makes the wrong combination —
// a login carrying a password hash, a signup with no name — impossible to write
// rather than merely discouraged.
export type CreateChallengeInput =
  | {
      purpose: 'signup';
      email: string;
      firstName: string;
      lastName: string;
      passwordHash: string;
      codeHash: string;
      expiresAt: Date;
    }
  | {
      purpose: 'login';
      email: string;
      userId: string;
      codeHash: string;
      expiresAt: Date;
    };

// Replaces the code on a challenge that is already in flight. Only the code and
// its expiry ever change: what a challenge is for is fixed when it is created,
// so a sign-up cannot have different details slid in behind an unread email.
export interface ReissueChallengeInput {
  codeHash: string;
  expiresAt: Date;
}

export interface OtpChallengeRepository {
  create(input: CreateChallengeInput): Promise<OtpChallenge>;
  findById(id: string): Promise<OtpChallenge | null>;
  // The unexpired challenge for this address and flow, if there is one. A repeat
  // request finds it and becomes a resend instead of a second email.
  findLive(email: string, purpose: OtpPurpose): Promise<OtpChallenge | null>;
  reissue(id: string, input: ReissueChallengeInput): Promise<OtpChallenge>;
  recordAttempt(id: string): Promise<OtpChallenge>;
  deleteById(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
}
