import { KIND_META } from '../constants/vault';
import { SCOPE_KIND } from '../constants/scopes';
import { Repositories } from '../domain/interfaces/unit-of-work';
import { AuditEntry, ConsentSelection } from '../domain/models';

export interface SharedField {
  scope: string;
  sensitive: boolean;
  snapshot: ConsentSelection['snapshot'];
}

export interface ConnectionView {
  clientId: string;
  clientName: string;
  purpose: string;
  scopes: string[];
  grantedAt: Date;
  shared: SharedField[];
}

export interface AuditView extends AuditEntry {
  clientName: string;
}

export interface AccountService {
  auditHistory(userId: string): Promise<AuditView[]>;
  connections(userId: string): Promise<ConnectionView[]>;
  revokeConnection(userId: string, clientId: string): Promise<string | null>;
}

export class AccountServiceImpl implements AccountService {
  constructor(private readonly repositories: Repositories) {}

  async auditHistory(userId: string): Promise<AuditView[]> {
    const [entries, clients] = await Promise.all([
      this.repositories.audit.listForUser(userId),
      this.repositories.clients.list(),
    ]);
    const nameById = new Map(clients.map((c) => [c.id, c.name]));
    return entries.map((entry) => ({
      ...entry,
      clientName: nameById.get(entry.clientId) ?? entry.clientId,
    }));
  }

  async connections(userId: string): Promise<ConnectionView[]> {
    const [consents, clients] = await Promise.all([
      this.repositories.consents.listForUser(userId),
      this.repositories.clients.list(),
    ]);
    const byId = new Map(clients.map((c) => [c.id, c]));

    return consents.map((consent) => {
      const client = byId.get(consent.clientId);
      return {
        clientId: consent.clientId,
        clientName: client?.name ?? consent.clientId,
        purpose: client?.purpose ?? '',
        scopes: consent.scopes,
        grantedAt: consent.grantedAt,
        shared: consent.selections.map((selection) => ({
          scope: selection.scope,
          sensitive: KIND_META[SCOPE_KIND[selection.scope]]?.sensitive ?? false,
          snapshot: selection.snapshot,
        })),
      };
    });
  }

  // Removes the stored connection, records the revocation, and returns the
  // grant id so the caller can revoke the live OIDC grant.
  async revokeConnection(userId: string, clientId: string): Promise<string | null> {
    const [consent, client] = await Promise.all([
      this.repositories.consents.findByUserAndClient(userId, clientId),
      this.repositories.clients.findById(clientId),
    ]);
    if (!consent) return null;

    await this.repositories.consents.deleteByUserAndClient(userId, clientId);
    await this.repositories.audit.record({
      userId,
      clientId,
      type: 'revoke',
      context: client?.purpose ?? '',
      scopesReleased: consent.scopes,
      fieldsReleased: [],
    });
    return consent.grantId;
  }
}
