import { AuditEntry, AuditType } from '../models';

export interface RecordAuditInput {
  userId: string;
  clientId: string;
  type: AuditType;
  context: string;
  scopesReleased: string[];
  fieldsReleased: string[];
}

export interface AuditRepository {
  record(input: RecordAuditInput): Promise<AuditEntry>;
  listForUser(userId: string): Promise<AuditEntry[]>;
}
