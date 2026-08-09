import {
  CreateChallengeInput,
  OtpChallengeRepository,
  ReissueChallengeInput,
} from '../domain/interfaces/otp-challenge.repository';
import { OtpChallenge, OtpPurpose } from '../domain/models';
import { DbClient } from '../infrastructure/db/db-client';

export class PrismaOtpChallengeRepository implements OtpChallengeRepository {
  constructor(private readonly db: DbClient) {}

  create(input: CreateChallengeInput): Promise<OtpChallenge> {
    return this.db.otpChallenge.create({ data: { ...input, lastSentAt: new Date() } });
  }

  findById(id: string): Promise<OtpChallenge | null> {
    return this.db.otpChallenge.findUnique({ where: { id } });
  }

  findLive(email: string, purpose: OtpPurpose): Promise<OtpChallenge | null> {
    return this.db.otpChallenge.findFirst({
      where: { email, purpose, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // The attempt counter resets with the code: the five tries are against the
  // code that was sent, not against the address for all time.
  reissue(id: string, input: ReissueChallengeInput): Promise<OtpChallenge> {
    return this.db.otpChallenge.update({
      where: { id },
      data: { ...input, attempts: 0, sends: { increment: 1 }, lastSentAt: new Date() },
    });
  }

  recordAttempt(id: string): Promise<OtpChallenge> {
    return this.db.otpChallenge.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.db.otpChallenge.deleteMany({ where: { id } });
  }

  async deleteExpired(): Promise<number> {
    const { count } = await this.db.otpChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }
}
