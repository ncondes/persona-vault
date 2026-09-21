import {
  CreateSigningKeyInput,
  SigningKeyRepository,
} from '../domain/interfaces/signing-key.repository';
import { KeyState, SigningKey } from '../domain/models';
import { DbClient } from '../infrastructure/db/db-client';

// Postgres orders an enum by its declaration order, and the enum is declared
// incoming, active, retiring — which is not the order the JWKS needs. Sorting in
// SQL would mean either a CASE expression or renaming the states to sort
// alphabetically; this keeps the states readable and does the ordering here,
// where the reason for it can be written down.
const PUBLISH_ORDER: Record<KeyState, number> = { active: 0, incoming: 1, retiring: 2 };

export class PrismaSigningKeyRepository implements SigningKeyRepository {
  constructor(private readonly db: DbClient) {}

  async listPublished(): Promise<SigningKey[]> {
    const keys = await this.db.signingKey.findMany({ orderBy: { createdAt: 'asc' } });
    return keys.sort(
      (a, b) => PUBLISH_ORDER[a.state as KeyState] - PUBLISH_ORDER[b.state as KeyState],
    ) as SigningKey[];
  }

  create(input: CreateSigningKeyInput): Promise<SigningKey> {
    return this.db.signingKey.create({
      data: {
        kid: input.kid,
        alg: input.alg,
        publicJwk: input.publicJwk as object,
        privateEncrypted: input.privateEncrypted,
        state: input.state,
        createdAt: input.createdAt,
        activatedAt: input.activatedAt ?? null,
      },
    }) as Promise<SigningKey>;
  }

  setState(
    kid: string,
    state: KeyState,
    at: { activatedAt?: Date; retiresAt?: Date },
  ): Promise<SigningKey> {
    return this.db.signingKey.update({
      where: { kid },
      data: { state, ...at },
    }) as Promise<SigningKey>;
  }

  async deleteRetired(now: Date): Promise<number> {
    const { count } = await this.db.signingKey.deleteMany({
      where: { state: 'retiring', retiresAt: { lte: now } },
    });
    return count;
  }
}
