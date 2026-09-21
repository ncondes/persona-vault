import { randomBytes } from 'node:crypto';
import { FIELD_ERRORS } from '../constants/field-errors';
import { ALL_SCOPES, PURPOSES, SCOPE_KIND } from '../constants/scopes';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors';
import { Repositories } from '../domain/interfaces/unit-of-work';
import { AuditType, Client, ClientStatus } from '../domain/models';
import { encryptSecret, generateClientSecret } from '../infrastructure/crypto/secret-box';
import { resolveClaims, suggestSelections } from './context.service';

// What the console sees. The encrypted secret and the owner id never leave the
// service; only the last four characters are shown, to identify a rotation.
export interface AppView {
  id: string;
  name: string;
  description: string | null;
  purpose: string;
  accent: string;
  allowedScopes: string[];
  requiredScopes: string[];
  redirectUris: string[];
  status: ClientStatus;
  secretLastFour: string;
  // The domain the developer proved control of, or null. Not the same as the
  // name they typed, which is still whatever they like.
  verifiedDomain: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Returned only by create and rotateSecret. The plaintext is unrecoverable
// afterwards.
export interface AppWithSecret extends AppView {
  secret: string;
}

export interface NewApp {
  name: string;
  description?: string | null;
  purpose: string;
  accent?: string;
  allowedScopes: string[];
  requiredScopes?: string[];
  redirectUris: string[];
}

export interface AppPatch extends Partial<NewApp> {
  status?: ClientStatus;
}

export interface PreviewView {
  claims: Record<string, unknown>;
  missing: string[];
}

export interface ActivityEvent {
  at: Date;
  type: AuditType;
  scopes: string[];
}

export interface ActivityView {
  users: number;
  grants: number;
  releases: number;
  revocations: number;
  recent: ActivityEvent[];
}

export interface UpdateResult {
  app: AppView;
  revokedGrantIds: string[];
}

const DEFAULT_ACCENT = 'teal';

function toAppView(client: Client): AppView {
  return {
    id: client.id,
    name: client.name,
    description: client.description,
    purpose: client.purpose,
    accent: client.accent,
    allowedScopes: client.allowedScopes,
    requiredScopes: client.requiredScopes,
    redirectUris: client.redirectUris,
    status: client.status,
    secretLastFour: client.secretLastFour,
    verifiedDomain: client.verifiedDomain,
    verifiedAt: client.verifiedAt,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

// Whether two sets of redirect URIs point at the same hosts. Compared by host
// rather than by string, so editing a path or adding a second URI on the same
// domain does not throw away a proof that still holds.
function sameHosts(before: string[], after: string[]): boolean {
  const hosts = (uris: string[]) =>
    [...new Set(uris.map((uri) => {
      try {
        return new URL(uri).hostname.toLowerCase();
      } catch {
        return uri;
      }
    }))].sort().join(',');
  return hosts(before) === hosts(after);
}

// Client ids are public: they appear in authorize URLs and in each demo app's
// configuration, so they stay readable rather than opaque.
function makeClientId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `${slug || 'app'}-${randomBytes(3).toString('hex')}`;
}

function validate(app: {
  purpose: string;
  allowedScopes: string[];
  requiredScopes: string[];
  redirectUris: string[];
}): Record<string, string> {
  const fields: Record<string, string> = {};

  if (!(PURPOSES as readonly string[]).includes(app.purpose)) {
    fields.purpose = FIELD_ERRORS.NOT_ALLOWED;
  }

  // A scope the provider does not know would make the client unusable: the
  // OIDC layer rejects unknown scopes when it loads the client metadata.
  const unknown = app.allowedScopes.filter((scope) => !(scope in SCOPE_KIND));
  if (unknown.length > 0) {
    fields.allowedScopes = FIELD_ERRORS.UNKNOWN_SCOPE;
  } else if (app.allowedScopes.length === 0) {
    fields.allowedScopes = FIELD_ERRORS.EMPTY_LIST;
  }

  const outside = app.requiredScopes.filter((scope) => !app.allowedScopes.includes(scope));
  if (outside.length > 0) {
    fields.requiredScopes = FIELD_ERRORS.REQUIRED_NOT_ALLOWED;
  }

  if (app.redirectUris.length === 0) {
    fields.redirectUris = FIELD_ERRORS.EMPTY_LIST;
  }

  return fields;
}

function assertValid(fields: Record<string, string>): void {
  if (Object.keys(fields).length > 0) {
    throw new ValidationError('Validation failed', fields);
  }
}

function canonicalScopes(app: { allowedScopes: string[]; requiredScopes: string[] }) {
  return {
    allowedScopes: ALL_SCOPES.filter((scope) => app.allowedScopes.includes(scope)),
    requiredScopes: ALL_SCOPES.filter((scope) => app.requiredScopes.includes(scope)),
  };
}

export interface ClientService {
  listForOwner(ownerId: string): Promise<AppView[]>;
  get(ownerId: string, id: string): Promise<AppView>;
  create(ownerId: string, input: NewApp): Promise<AppWithSecret>;
  update(ownerId: string, id: string, patch: AppPatch): Promise<UpdateResult>;
  remove(ownerId: string, id: string): Promise<string[]>;
  rotateSecret(ownerId: string, id: string): Promise<AppWithSecret>;
  preview(userId: string, purpose: string, scopes: string[]): Promise<PreviewView>;
  activity(ownerId: string, id: string): Promise<ActivityView>;
  // The whole row, for the one caller that needs more than the console view:
  // domain verification works from the registered redirect URIs.
  ownedClient(ownerId: string, id: string): Promise<Client>;
  // Seed only: registers an app with a fixed id and secret so the demo clients
  // survive a rebuild. Shares create()'s validation and encryption.
  register(ownerId: string, id: string, secret: string, input: NewApp): Promise<AppView>;
}

export class ClientServiceImpl implements ClientService {
  constructor(private readonly repositories: Repositories) {}

  async listForOwner(ownerId: string): Promise<AppView[]> {
    const clients = await this.repositories.clients.listByOwner(ownerId);
    return clients.map(toAppView);
  }

  async get(ownerId: string, id: string): Promise<AppView> {
    return toAppView(await this.owned(ownerId, id));
  }

  async create(ownerId: string, input: NewApp): Promise<AppWithSecret> {
    const app = this.prepare(input);

    const id = makeClientId(app.name);
    if (await this.repositories.clients.findById(id)) {
      throw new ConflictError('That app id is already taken', 'APP_ID_TAKEN');
    }

    const secret = generateClientSecret();
    const client = await this.repositories.clients.upsert({
      id,
      ownerId,
      ...app,
      secretEncrypted: encryptSecret(secret),
      secretLastFour: secret.slice(-4),
    });
    return { ...toAppView(client), secret };
  }

  async register(ownerId: string, id: string, secret: string, input: NewApp): Promise<AppView> {
    const app = this.prepare(input);
    const client = await this.repositories.clients.upsert({
      id,
      ownerId,
      ...app,
      secretEncrypted: encryptSecret(secret),
      secretLastFour: secret.slice(-4),
    });
    return toAppView(client);
  }

  async update(ownerId: string, id: string, patch: AppPatch): Promise<UpdateResult> {
    const client = await this.owned(ownerId, id);
    const next = {
      purpose: patch.purpose ?? client.purpose,
      allowedScopes: patch.allowedScopes ?? client.allowedScopes,
      requiredScopes: patch.requiredScopes ?? client.requiredScopes,
      redirectUris: patch.redirectUris ?? client.redirectUris,
    };
    assertValid(validate(next));

    const removed = client.allowedScopes.filter((scope) => !next.allowedScopes.includes(scope));

    // A domain proved for one set of redirect URIs says nothing about another,
    // so pointing the app somewhere else takes the badge down. Leaving it up is
    // the one failure that would matter: an unverified app looking verified.
    const movedHost = patch.redirectUris !== undefined && !sameHosts(client.redirectUris, next.redirectUris);

    const updated = await this.repositories.clients.update(id, {
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description?.trim() || null }
        : {}),
      ...(patch.allowedScopes || patch.requiredScopes ? canonicalScopes(next) : {}),
      ...(movedHost
        ? {
            verifiedDomain: null,
            verifiedAt: null,
            verificationToken: null,
            verificationIssuedAt: null,
          }
        : {}),
    });

    // Narrowing the scope list invalidates every standing consent: users
    // approved a wider set than the app now declares, so they are asked again
    // rather than left with a grant naming scopes the app dropped.
    const revokedGrantIds = removed.length > 0 ? await this.revokeAllConsents(updated) : [];
    return { app: toAppView(updated), revokedGrantIds };
  }

  async remove(ownerId: string, id: string): Promise<string[]> {
    const client = await this.owned(ownerId, id);
    // No revoke audit entries here: deleting the client cascades its consents
    // and audit rows away, so writing them first would only be undone.
    const consents = await this.repositories.consents.listForClient(id);
    await this.repositories.clients.delete(id);
    return consents.map((consent) => consent.grantId).filter((id): id is string => id !== null);
  }

  async rotateSecret(ownerId: string, id: string): Promise<AppWithSecret> {
    await this.owned(ownerId, id);
    const secret = generateClientSecret();
    const client = await this.repositories.clients.update(id, {
      secretEncrypted: encryptSecret(secret),
      secretLastFour: secret.slice(-4),
    });
    return { ...toAppView(client), secret };
  }

  async preview(userId: string, purpose: string, scopes: string[]): Promise<PreviewView> {
    const requested = scopes.filter((scope) => scope in SCOPE_KIND);
    const items = await this.repositories.vault.listForUser(userId);

    // With no stored selections, resolveClaims falls back to the context-aware
    // suggestion — exactly what a first consent would release.
    const resolved = resolveClaims({
      purpose,
      allowedScopes: requested,
      grantedScopes: requested,
      selections: [],
      items,
    });
    const missing = suggestSelections(purpose, requested, requested, items)
      .filter((suggestion) => suggestion.missing)
      .map((suggestion) => suggestion.scope);

    return { claims: { sub: userId, ...resolved.claims }, missing };
  }

  async activity(ownerId: string, id: string): Promise<ActivityView> {
    await this.owned(ownerId, id);
    const [users, counts, recent] = await Promise.all([
      this.repositories.consents.countForClient(id),
      this.repositories.audit.countByTypeForClient(id),
      this.repositories.audit.listForClient(id, 20),
    ]);
    // A developer sees volume and scope names, never who connected or which
    // value they shared.
    return {
      users,
      grants: counts.grant,
      releases: counts.release,
      revocations: counts.revoke,
      recent: recent.map((entry) => ({
        at: entry.at,
        type: entry.type,
        scopes: entry.scopesReleased,
      })),
    };
  }

  // Applies defaults, validates the raw values, then puts the scopes in
  // catalog order so the OIDC scope string stays stable across edits.
  private prepare(input: NewApp) {
    const app = {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      purpose: input.purpose,
      accent: input.accent ?? DEFAULT_ACCENT,
      allowedScopes: input.allowedScopes,
      requiredScopes: input.requiredScopes ?? [],
      redirectUris: input.redirectUris,
    };
    assertValid(validate(app));
    return { ...app, ...canonicalScopes(app) };
  }

  ownedClient(ownerId: string, id: string): Promise<Client> {
    return this.owned(ownerId, id);
  }

  // A foreign app reports as missing so client ids cannot be probed by a
  // signed-in developer who does not own them.
  private async owned(ownerId: string, id: string): Promise<Client> {
    const client = await this.repositories.clients.findById(id);
    if (!client || client.ownerId !== ownerId) {
      throw new NotFoundError('App not found', 'APP_NOT_FOUND');
    }
    return client;
  }

  // Drops every standing consent for an app and returns the grant ids so the
  // caller can revoke the matching OIDC grants.
  private async revokeAllConsents(client: Client): Promise<string[]> {
    const consents = await this.repositories.consents.listForClient(client.id);
    const grantIds: string[] = [];

    for (const consent of consents) {
      await this.repositories.consents.deleteByUserAndClient(consent.userId, client.id);
      await this.repositories.audit.record({
        userId: consent.userId,
        clientId: client.id,
        type: 'revoke',
        context: client.purpose,
        scopesReleased: consent.scopes,
        fieldsReleased: [],
      });
      if (consent.grantId) grantIds.push(consent.grantId);
    }

    return grantIds;
  }
}
