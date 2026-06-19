import { Repositories } from '../domain/interfaces/unit-of-work';
import { AuditEntry } from '../domain/models';

export interface ConnectionView {
  clientId: string;
  clientName: string;
  scopes: string[];
  grantedAt: Date;
}

export interface AccountService {
  auditHistory(userId: string): Promise<AuditEntry[]>;
  connections(userId: string): Promise<ConnectionView[]>;
  revokeConnection(userId: string, clientId: string): Promise<string | null>;
}

export class AccountServiceImpl implements AccountService {
  constructor(private readonly repositories: Repositories) {}

  auditHistory(userId: string): Promise<AuditEntry[]> {
    return this.repositories.audit.listForUser(userId);
  }

  async connections(userId: string): Promise<ConnectionView[]> {
    const [consents, clients] = await Promise.all([
      this.repositories.consents.listForUser(userId),
      this.repositories.clients.list(),
    ]);
    const nameById = new Map(clients.map((c) => [c.id, c.name]));

    return consents.map((c) => ({
      clientId: c.clientId,
      clientName: nameById.get(c.clientId) ?? c.clientId,
      scopes: c.scopes,
      grantedAt: c.grantedAt,
    }));
  }

  // Removes the stored connection and returns its grant id, so the caller can
  // revoke the live OIDC grant.
  async revokeConnection(userId: string, clientId: string): Promise<string | null> {
    const consent = await this.repositories.consents.findByUserAndClient(userId, clientId);
    await this.repositories.consents.deleteByUserAndClient(userId, clientId);
    return consent?.grantId ?? null;
  }
}
