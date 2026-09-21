// In-memory repository fakes, shared by the unit tests. Possible at all because
// every service depends on the interfaces in `src/domain/interfaces`, not on
// Prisma — so none of these tests need a database.
//
// Keep them dumb: a fake that grows its own rules stops testing the service and
// starts testing itself. Anything requiring real SQL behaviour belongs in an
// `*.int.test.ts` instead.
import { AuditRepository, RecordAuditInput } from '../../src/domain/interfaces/audit.repository';
import {
  ClientRepository,
  SaveClientInput,
  UpdateClientInput,
} from '../../src/domain/interfaces/client.repository';
import {
  ConsentRepository,
  RecordConsentInput,
} from '../../src/domain/interfaces/consent.repository';
import {
  OidcPayloadData,
  OidcPayloadRepository,
  UpsertOidcPayloadInput,
} from '../../src/domain/interfaces/oidc-payload.repository';
import {
  CreateChallengeInput,
  OtpChallengeRepository,
  ReissueChallengeInput,
} from '../../src/domain/interfaces/otp-challenge.repository';
import {
  CreateSigningKeyInput,
  SigningKeyRepository,
} from '../../src/domain/interfaces/signing-key.repository';
import { Repositories, UnitOfWork } from '../../src/domain/interfaces/unit-of-work';
import {
  CreateUserInput,
  UpdateSettingsInput,
  UserRepository,
} from '../../src/domain/interfaces/user.repository';
import {
  CreateVaultItemInput,
  UpdateVaultItemInput,
  VaultRepository,
} from '../../src/domain/interfaces/vault.repository';
import { NotFoundError } from '../../src/domain/errors';
import {
  AuditEntry,
  AuditType,
  Client,
  Consent,
  KeyState,
  OtpChallenge,
  OtpPurpose,
  SigningKey,
  User,
  VaultItem,
  VaultKind,
} from '../../src/domain/models';

let counter = 0;

export function vaultItem(
  kind: VaultItem['kind'],
  value: string,
  extra: Partial<VaultItem> = {},
): VaultItem {
  counter += 1;
  return {
    id: `item-${counter}`,
    userId: 'owner-1',
    kind,
    label: null,
    value,
    detail: null,
    isDefault: false,
    nameContext: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  } as VaultItem;
}

export function client(overrides: Partial<Client> = {}): Client {
  return {
    id: 'clinic',
    ownerId: 'owner-1',
    name: 'City Health Clinic',
    description: null,
    purpose: 'healthcare',
    accent: 'teal',
    allowedScopes: ['name', 'email'],
    requiredScopes: [],
    redirectUris: ['http://localhost:4411/callback'],
    secretEncrypted: 'not-a-real-secret',
    secretLastFour: 'abcd',
    status: 'active',
    verifiedDomain: null,
    verifiedAt: null,
    verificationToken: null,
    verificationIssuedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Client;
}

export class FakeUsers implements UserRepository {
  rows: User[] = [];

  async create(input: CreateUserInput): Promise<User> {
    const user: User = {
      id: String(this.rows.length + 1),
      email: input.email,
      passwordHash: input.passwordHash,
      confirmSensitive: true,
      notifyAccess: false,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    this.rows.push(user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.rows.find((row) => row.email === email) ?? null;
  }

  async updateSettings(userId: string, patch: UpdateSettingsInput): Promise<User> {
    const user = this.rows.find((row) => row.id === userId)!;
    Object.assign(user, patch);
    return user;
  }

  async deleteById(userId: string): Promise<void> {
    const at = this.rows.findIndex((row) => row.id === userId);
    if (at !== -1) this.rows.splice(at, 1);
  }
}

export class FakeVault implements VaultRepository {
  constructor(public rows: VaultItem[] = []) {}

  async listForUser(userId: string): Promise<VaultItem[]> {
    return this.rows.filter((row) => row.userId === userId);
  }
  async listByKind(userId: string, kind: VaultKind): Promise<VaultItem[]> {
    return this.rows.filter((row) => row.userId === userId && row.kind === kind);
  }
  async findByIds(userId: string, ids: string[]): Promise<VaultItem[]> {
    return this.rows.filter((row) => row.userId === userId && ids.includes(row.id));
  }
  async create(input: CreateVaultItemInput): Promise<VaultItem> {
    const row = vaultItem(input.kind, input.value, input);
    this.rows.push(row);
    return row;
  }
  async update(userId: string, id: string, patch: UpdateVaultItemInput): Promise<VaultItem> {
    const at = this.rows.findIndex((row) => row.userId === userId && row.id === id);
    if (at === -1) throw new NotFoundError('Vault item not found');
    this.rows[at] = { ...this.rows[at], ...patch } as VaultItem;
    return this.rows[at];
  }
  async delete(userId: string, id: string): Promise<void> {
    const at = this.rows.findIndex((row) => row.userId === userId && row.id === id);
    if (at === -1) throw new NotFoundError('Vault item not found');
    this.rows.splice(at, 1);
  }
  async clearDefault(userId: string, kind: VaultKind): Promise<void> {
    for (const row of this.rows) {
      if (row.userId === userId && row.kind === kind) row.isDefault = false;
    }
  }
}

export class FakeClients implements ClientRepository {
  rows: Client[] = [];

  async findById(id: string): Promise<Client | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
  async list(): Promise<Client[]> {
    return this.rows;
  }
  async listByOwner(ownerId: string): Promise<Client[]> {
    return this.rows.filter((row) => row.ownerId === ownerId);
  }
  async upsert(input: SaveClientInput): Promise<Client> {
    const row: Client = {
      ...input,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const at = this.rows.findIndex((existing) => existing.id === input.id);
    if (at >= 0) this.rows[at] = { ...this.rows[at], ...row };
    else this.rows.push(row);
    return (await this.findById(input.id)) as Client;
  }
  async update(id: string, patch: UpdateClientInput): Promise<Client> {
    const at = this.rows.findIndex((row) => row.id === id);
    this.rows[at] = { ...this.rows[at], ...patch, updatedAt: new Date() };
    return this.rows[at];
  }
  async delete(id: string): Promise<void> {
    this.rows = this.rows.filter((row) => row.id !== id);
  }
}

export class FakeConsents implements ConsentRepository {
  rows: Consent[] = [];

  async record(input: RecordConsentInput): Promise<Consent> {
    const row: Consent = {
      id: `consent-${this.rows.length + 1}`,
      grantedAt: new Date(),
      ...input,
    } as Consent;
    const at = this.rows.findIndex(
      (existing) => existing.userId === input.userId && existing.clientId === input.clientId,
    );
    if (at >= 0) this.rows[at] = { ...this.rows[at], ...row };
    else this.rows.push(row);
    return row;
  }
  async listForUser(userId: string): Promise<Consent[]> {
    return this.rows.filter((row) => row.userId === userId);
  }
  async listForClient(clientId: string): Promise<Consent[]> {
    return this.rows.filter((row) => row.clientId === clientId);
  }
  async countForClient(clientId: string): Promise<number> {
    return (await this.listForClient(clientId)).length;
  }
  async findByUserAndClient(userId: string, clientId: string): Promise<Consent | null> {
    return this.rows.find((row) => row.userId === userId && row.clientId === clientId) ?? null;
  }
  async deleteByUserAndClient(userId: string, clientId: string): Promise<void> {
    this.rows = this.rows.filter((row) => !(row.userId === userId && row.clientId === clientId));
  }
}

export class FakeAudit implements AuditRepository {
  rows: RecordAuditInput[] = [];

  async record(input: RecordAuditInput): Promise<AuditEntry> {
    this.rows.push(input);
    return { id: `audit-${this.rows.length}`, at: new Date(), ...input };
  }
  async listForUser(userId: string): Promise<AuditEntry[]> {
    return this.rows
      .filter((row) => row.userId === userId)
      .map((row, index) => ({ id: `audit-${index}`, at: new Date(), ...row }));
  }
  async listForClient(clientId: string, limit: number): Promise<AuditEntry[]> {
    return this.rows
      .filter((row) => row.clientId === clientId)
      .slice(0, limit)
      .map((row, index) => ({ id: `audit-${index}`, at: new Date(), ...row }));
  }
  async countByTypeForClient(clientId: string): Promise<Record<AuditType, number>> {
    const counts: Record<AuditType, number> = { grant: 0, release: 0, revoke: 0 };
    for (const row of this.rows.filter((entry) => entry.clientId === clientId)) {
      counts[row.type] += 1;
    }
    return counts;
  }
}

// Stands in for PrismaOidcPayloadRepository in the adapter tests.
// `oidc-payload.repository.int.test.ts` runs the same script of operations
// against this and the real thing and compares, so the two cannot drift.
export class FakePayloads implements OidcPayloadRepository {
  rows: UpsertOidcPayloadInput[] = [];

  private index(model: string, id: string): number {
    return this.rows.findIndex((row) => row.model === model && row.id === id);
  }

  private live(row: UpsertOidcPayloadInput): boolean {
    return !row.expiresAt || row.expiresAt.getTime() > Date.now();
  }

  async upsert(input: UpsertOidcPayloadInput): Promise<void> {
    const at = this.index(input.model, input.id);
    if (at >= 0) this.rows[at] = input;
    else this.rows.push(input);
  }

  async find(model: string, id: string): Promise<OidcPayloadData | null> {
    const at = this.index(model, id);
    return at >= 0 && this.live(this.rows[at]) ? this.rows[at].payload : null;
  }

  async findByUid(uid: string): Promise<OidcPayloadData | null> {
    return this.rows.find((row) => row.uid === uid && this.live(row))?.payload ?? null;
  }

  async findByUserCode(userCode: string): Promise<OidcPayloadData | null> {
    return this.rows.find((row) => row.userCode === userCode && this.live(row))?.payload ?? null;
  }

  async setPayload(model: string, id: string, payload: OidcPayloadData): Promise<void> {
    const at = this.index(model, id);
    if (at >= 0) this.rows[at] = { ...this.rows[at], payload };
  }

  async destroy(model: string, id: string): Promise<void> {
    this.rows = this.rows.filter((row) => !(row.model === model && row.id === id));
  }

  // Mirrors the Prisma repository, including its Interaction exclusion.
  async deleteByGrantId(grantId: string): Promise<void> {
    this.rows = this.rows.filter((row) => row.grantId !== grantId || row.model === 'Interaction');
  }

  async deleteExpired(): Promise<number> {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => this.live(row));
    return before - this.rows.length;
  }
}

// Mirrors PrismaSigningKeyRepository's ordering, because the order of the set is
// what decides which key signs: oidc-provider takes the first one that matches.
const PUBLISH_ORDER: Record<KeyState, number> = { active: 0, incoming: 1, retiring: 2 };

export class FakeSigningKeys implements SigningKeyRepository {
  readonly rows: SigningKey[] = [];

  async listPublished(): Promise<SigningKey[]> {
    return [...this.rows]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .sort((a, b) => PUBLISH_ORDER[a.state] - PUBLISH_ORDER[b.state]);
  }

  async create(input: CreateSigningKeyInput): Promise<SigningKey> {
    const row: SigningKey = {
      kid: input.kid,
      alg: input.alg,
      publicJwk: input.publicJwk,
      privateEncrypted: input.privateEncrypted,
      state: input.state,
      createdAt: input.createdAt,
      activatedAt: input.activatedAt ?? null,
      retiresAt: null,
    };
    this.rows.push(row);
    return row;
  }

  async setState(
    kid: string,
    state: KeyState,
    at: { activatedAt?: Date; retiresAt?: Date },
  ): Promise<SigningKey> {
    const row = this.rows.find((key) => key.kid === kid);
    if (!row) throw new NotFoundError();
    row.state = state;
    if (at.activatedAt) row.activatedAt = at.activatedAt;
    if (at.retiresAt) row.retiresAt = at.retiresAt;
    return row;
  }

  async deleteRetired(now: Date): Promise<number> {
    const doomed = this.rows.filter(
      (key) => key.state === 'retiring' && key.retiresAt !== null && key.retiresAt <= now,
    );
    for (const key of doomed) this.rows.splice(this.rows.indexOf(key), 1);
    return doomed.length;
  }
}

export class FakeOtpChallenges implements OtpChallengeRepository {
  rows: OtpChallenge[] = [];
  private next = 1;

  async create(input: CreateChallengeInput): Promise<OtpChallenge> {
    const row: OtpChallenge = {
      id: String(this.next++),
      email: input.email,
      userId: null,
      firstName: null,
      lastName: null,
      passwordHash: null,
      attempts: 0,
      sends: 1,
      lastSentAt: new Date(),
      createdAt: new Date(),
      ...input,
    };
    this.rows.push(row);
    return row;
  }

  async findById(id: string): Promise<OtpChallenge | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findLive(email: string, purpose: OtpPurpose): Promise<OtpChallenge | null> {
    const now = Date.now();
    return (
      this.rows.find(
        (row) =>
          row.email === email && row.purpose === purpose && row.expiresAt.getTime() > now,
      ) ?? null
    );
  }

  async reissue(id: string, input: ReissueChallengeInput): Promise<OtpChallenge> {
    const row = this.rows.find((entry) => entry.id === id)!;
    Object.assign(row, input, {
      attempts: 0,
      sends: row.sends + 1,
      lastSentAt: new Date(),
    });
    return row;
  }

  async recordAttempt(id: string): Promise<OtpChallenge> {
    const row = this.rows.find((entry) => entry.id === id)!;
    row.attempts += 1;
    return row;
  }

  async deleteById(id: string): Promise<void> {
    this.rows = this.rows.filter((row) => row.id !== id);
  }

  async deleteExpired(): Promise<number> {
    const now = Date.now();
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => row.expiresAt.getTime() >= now);
    return before - this.rows.length;
  }
}

export interface FakeRepositories {
  users: FakeUsers;
  vault: FakeVault;
  clients: FakeClients;
  consents: FakeConsents;
  audit: FakeAudit;
  otpChallenges: FakeOtpChallenges;
  signingKeys: FakeSigningKeys;
  repositories: Repositories;
  unitOfWork: UnitOfWork;
}

// One assembled set. `repositories` is cast because `oidcPayloads` has no fake —
// no service touches it, only the OIDC adapter does, and that has its own suite.
export function fakeRepositories(items: VaultItem[] = []): FakeRepositories {
  const users = new FakeUsers();
  const vault = new FakeVault(items);
  const clients = new FakeClients();
  const consents = new FakeConsents();
  const audit = new FakeAudit();
  const otpChallenges = new FakeOtpChallenges();
  const signingKeys = new FakeSigningKeys();
  const repositories = {
    users,
    vault,
    clients,
    consents,
    audit,
    otpChallenges,
    signingKeys,
  } as unknown as Repositories;
  return {
    users,
    vault,
    clients,
    consents,
    audit,
    otpChallenges,
    signingKeys,
    repositories,
    unitOfWork: { run: (work) => work(repositories) },
  };
}

// Every service throws AppError subclasses, so tests assert on `code` rather than
// on a message string.
export async function errorFrom<T extends { code: string }>(run: Promise<unknown>): Promise<T> {
  try {
    await run;
  } catch (err) {
    return err as T;
  }
  throw new Error('expected the call to reject');
}
