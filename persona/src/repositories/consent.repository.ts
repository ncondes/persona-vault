import { ConsentRepository, RecordConsentInput } from '../domain/interfaces/consent.repository';
import { Consent } from '../domain/models';
import { DbClient } from '../infrastructure/db/db-client';

export class PrismaConsentRepository implements ConsentRepository {
  constructor(private readonly db: DbClient) {}

  record(input: RecordConsentInput): Promise<Consent> {
    return this.db.consent.upsert({
      where: { userId_clientId: { userId: input.userId, clientId: input.clientId } },
      create: input,
      update: { scopes: input.scopes, grantId: input.grantId, grantedAt: new Date() },
    });
  }

  listForUser(userId: string): Promise<Consent[]> {
    return this.db.consent.findMany({ where: { userId }, orderBy: { grantedAt: 'desc' } });
  }

  findByUserAndClient(userId: string, clientId: string): Promise<Consent | null> {
    return this.db.consent.findUnique({ where: { userId_clientId: { userId, clientId } } });
  }

  async deleteByUserAndClient(userId: string, clientId: string): Promise<void> {
    await this.db.consent.deleteMany({ where: { userId, clientId } });
  }
}
