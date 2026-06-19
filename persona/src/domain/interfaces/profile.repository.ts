import { NameVariant, NameVariantKind, ProfileField, ProfileFieldKey } from '../models';

export interface ProfileRepository {
  listNameVariants(userId: string): Promise<NameVariant[]>;
  listProfileFields(userId: string): Promise<ProfileField[]>;
  setNameVariant(userId: string, kind: NameVariantKind, value: string): Promise<NameVariant>;
  setProfileField(
    userId: string,
    key: ProfileFieldKey,
    value: string,
    sensitive: boolean,
  ): Promise<ProfileField>;
}
