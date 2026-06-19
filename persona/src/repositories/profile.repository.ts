import { ProfileRepository } from '../domain/interfaces/profile.repository';
import { NameVariant, NameVariantKind, ProfileField, ProfileFieldKey } from '../domain/models';
import { DbClient } from '../infrastructure/db/db-client';

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly db: DbClient) {}

  listNameVariants(userId: string): Promise<NameVariant[]> {
    return this.db.nameVariant.findMany({ where: { userId } });
  }

  listProfileFields(userId: string): Promise<ProfileField[]> {
    return this.db.profileField.findMany({ where: { userId } });
  }

  // Inserts the variant, or updates its value if it already exists.
  setNameVariant(userId: string, kind: NameVariantKind, value: string): Promise<NameVariant> {
    return this.db.nameVariant.upsert({
      where: { userId_kind: { userId, kind } },
      create: { userId, kind, value },
      update: { value },
    });
  }

  setProfileField(
    userId: string,
    key: ProfileFieldKey,
    value: string,
    sensitive: boolean,
  ): Promise<ProfileField> {
    return this.db.profileField.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value, sensitive },
      update: { value, sensitive },
    });
  }
}
