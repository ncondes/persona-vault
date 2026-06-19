import { AuditRepository, RecordReleaseInput } from '../domain/interfaces/audit.repository';
import { AuditEntry } from '../domain/models';
import { DbClient } from '../infrastructure/db/db-client';

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly db: DbClient) {}

  recordRelease(input: RecordReleaseInput): Promise<AuditEntry> {
    return this.db.auditEntry.create({ data: input });
  }

  listForUser(userId: string): Promise<AuditEntry[]> {
    return this.db.auditEntry.findMany({ where: { userId }, orderBy: { at: 'desc' } });
  }
}
