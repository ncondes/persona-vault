import { ConsentRepository, RecordConsentInput } from '../domain/interfaces/consent.repository';
import { Consent, ConsentSelection } from '../domain/models';
import { DbClient } from '../infrastructure/db/db-client';
import { Prisma } from '../generated/prisma/client';

// Prisma stores `selections` as Json; the domain types it as ConsentSelection[].
function toConsent(row: Omit<Consent, 'selections'> & { selections: unknown }): Consent {
  return { ...row, selections: (row.selections as ConsentSelection[]) ?? [] };
}

export class PrismaConsentRepository implements ConsentRepository {
  constructor(private readonly db: DbClient) {}

  async record(input: RecordConsentInput): Promise<Consent> {
    const selections = input.selections as unknown as Prisma.InputJsonValue;
    const row = await this.db.consent.upsert({
      where: { userId_clientId: { userId: input.userId, clientId: input.clientId } },
      create: { ...input, selections },
      update: { scopes: input.scopes, selections, grantId: input.grantId, grantedAt: new Date() },
    });
    return toConsent(row);
  }

  async listForUser(userId: string): Promise<Consent[]> {
    const rows = await this.db.consent.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
    });
    return rows.map(toConsent);
  }

  async listForClient(clientId: string): Promise<Consent[]> {
    const rows = await this.db.consent.findMany({
      where: { clientId },
      orderBy: { grantedAt: 'desc' },
    });
    return rows.map(toConsent);
  }

  countForClient(clientId: string): Promise<number> {
    return this.db.consent.count({ where: { clientId } });
  }

  async findByUserAndClient(userId: string, clientId: string): Promise<Consent | null> {
    const row = await this.db.consent.findUnique({
      where: { userId_clientId: { userId, clientId } },
    });
    return row ? toConsent(row) : null;
  }

  async deleteByUserAndClient(userId: string, clientId: string): Promise<void> {
    await this.db.consent.deleteMany({ where: { userId, clientId } });
  }
}
