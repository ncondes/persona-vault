import { KIND_META } from '../constants/vault';
import { SCOPE_KIND } from '../constants/scopes';
import { NotFoundError } from '../domain/errors';
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

export interface SettingsView {
  confirmSensitive: boolean;
  notifyAccess: boolean;
}

export interface SettingsPatch {
  confirmSensitive?: boolean;
  notifyAccess?: boolean;
}

export interface DataExport {
  user: { email: string; createdAt: Date; settings: SettingsView };
  vault: unknown[];
  connections: ConnectionView[];
  audit: AuditView[];
}

export interface AccountService {
  auditHistory(userId: string): Promise<AuditView[]>;
  connections(userId: string): Promise<ConnectionView[]>;
  revokeConnection(userId: string, clientId: string): Promise<string | null>;
  settings(userId: string): Promise<SettingsView>;
  updateSettings(userId: string, patch: SettingsPatch): Promise<SettingsView>;
  exportData(userId: string): Promise<DataExport>;
  // Deletes the account (the vault, consents and audit cascade with it) and
  // returns the live grant ids so the caller can revoke them.
  deleteAccount(userId: string): Promise<string[]>;
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

  async settings(userId: string): Promise<SettingsView> {
    const user = await this.repositories.users.findById(userId);
    if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    return { confirmSensitive: user.confirmSensitive, notifyAccess: user.notifyAccess };
  }

  async updateSettings(userId: string, patch: SettingsPatch): Promise<SettingsView> {
    const user = await this.repositories.users.updateSettings(userId, patch);
    return { confirmSensitive: user.confirmSensitive, notifyAccess: user.notifyAccess };
  }

  async exportData(userId: string): Promise<DataExport> {
    const user = await this.repositories.users.findById(userId);
    if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND');

    const [vault, connections, audit] = await Promise.all([
      this.repositories.vault.listForUser(userId),
      this.connections(userId),
      this.auditHistory(userId),
    ]);

    return {
      user: {
        email: user.email,
        createdAt: user.createdAt,
        settings: { confirmSensitive: user.confirmSensitive, notifyAccess: user.notifyAccess },
      },
      vault: vault.map((item) => ({
        ...item,
        sensitive: KIND_META[item.kind].sensitive,
      })),
      connections,
      audit,
    };
  }

  async deleteAccount(userId: string): Promise<string[]> {
    const consents = await this.repositories.consents.listForUser(userId);
    const grantIds = consents
      .map((consent) => consent.grantId)
      .filter((id): id is string => Boolean(id));
    await this.repositories.users.deleteById(userId);
    return grantIds;
  }
}
