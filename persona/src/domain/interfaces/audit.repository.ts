import { AuditEntry } from '../models';

export interface RecordReleaseInput {
  userId: string;
  clientId: string;
  context: string;
  scopesReleased: string[];
  fieldsReleased: string[];
}

export interface AuditRepository {
  recordRelease(input: RecordReleaseInput): Promise<AuditEntry>;
  listForUser(userId: string): Promise<AuditEntry[]>;
}
