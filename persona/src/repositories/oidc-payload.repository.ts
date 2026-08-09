import {
  OidcPayloadData,
  OidcPayloadRepository,
  UpsertOidcPayloadInput,
} from '../domain/interfaces/oidc-payload.repository';
import { DbClient } from '../infrastructure/db/db-client';
import { Prisma } from '../generated/prisma/client';

// A row is live when it has no expiry or the expiry is still ahead.
const unexpired = { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };

function toData(row: { payload: unknown } | null): OidcPayloadData | null {
  return row ? (row.payload as OidcPayloadData) : null;
}

export class PrismaOidcPayloadRepository implements OidcPayloadRepository {
  constructor(private readonly db: DbClient) {}

  async upsert(input: UpsertOidcPayloadInput): Promise<void> {
    const { model, id, payload, ...rest } = input;
    const data = { ...rest, payload: payload as Prisma.InputJsonValue };
    await this.db.oidcPayload.upsert({
      where: { model_id: { model, id } },
      create: { model, id, ...data },
      update: data,
    });
  }

  async find(model: string, id: string): Promise<OidcPayloadData | null> {
    const row = await this.db.oidcPayload.findFirst({
      where: { model, id, ...unexpired },
    });
    return toData(row);
  }

  async findByUid(uid: string): Promise<OidcPayloadData | null> {
    return toData(await this.db.oidcPayload.findFirst({ where: { uid, ...unexpired } }));
  }

  async findByUserCode(userCode: string): Promise<OidcPayloadData | null> {
    return toData(await this.db.oidcPayload.findFirst({ where: { userCode, ...unexpired } }));
  }

  async setPayload(model: string, id: string, payload: OidcPayloadData): Promise<void> {
    await this.db.oidcPayload.updateMany({
      where: { model, id },
      data: { payload: payload as Prisma.InputJsonValue },
    });
  }

  // deleteMany, not delete: oidc-provider destroys artifacts that may already
  // be gone, and Prisma's `delete` throws P2025 on a missing row.
  async destroy(model: string, id: string): Promise<void> {
    await this.db.oidcPayload.deleteMany({ where: { model, id } });
  }

  // Interactions are excluded: an interaction is an in-flight authorization
  // request, not a credential, and it carries the grant id it resumed. Deleting
  // it here would destroy the very request that is revoking the grant — which
  // is exactly what happens when a user re-consents to an app.
  async deleteByGrantId(grantId: string): Promise<void> {
    await this.db.oidcPayload.deleteMany({
      where: { grantId, model: { not: 'Interaction' } },
    });
  }

  async deleteExpired(): Promise<number> {
    const { count } = await this.db.oidcPayload.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }
}
