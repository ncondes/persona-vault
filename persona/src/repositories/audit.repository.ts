import { AuditRepository, RecordAuditInput } from '../domain/interfaces/audit.repository';
import { AuditEntry, AuditType } from '../domain/models';
import { DbClient } from '../infrastructure/db/db-client';

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly db: DbClient) {}

  record(input: RecordAuditInput): Promise<AuditEntry> {
    return this.db.auditEntry.create({ data: input });
  }

  listForUser(userId: string): Promise<AuditEntry[]> {
    return this.db.auditEntry.findMany({ where: { userId }, orderBy: { at: 'desc' } });
  }

  listForClient(clientId: string, limit: number): Promise<AuditEntry[]> {
    return this.db.auditEntry.findMany({
      where: { clientId },
      orderBy: { at: 'desc' },
      take: limit,
    });
  }

  async countByTypeForClient(clientId: string): Promise<Record<AuditType, number>> {
    const rows = await this.db.auditEntry.groupBy({
      by: ['type'],
      where: { clientId },
      _count: { _all: true },
    });
    const counts: Record<AuditType, number> = { grant: 0, release: 0, revoke: 0 };
    for (const row of rows) {
      counts[row.type as AuditType] = row._count._all;
    }
    return counts;
  }
}
