import { Repositories, UnitOfWork } from '../domain/interfaces/unit-of-work';
import { NameVariantKind, ProfileFieldKey } from '../domain/models';

export interface ProfileView {
  names: Partial<Record<NameVariantKind, string>>;
  fields: Partial<Record<ProfileFieldKey, { value: string; sensitive: boolean }>>;
}

export interface ProfileUpdate {
  names?: Partial<Record<NameVariantKind, string>>;
  fields?: Partial<Record<ProfileFieldKey, { value: string; sensitive?: boolean }>>;
}

export interface ProfileService {
  getProfile(userId: string): Promise<ProfileView>;
  updateProfile(userId: string, update: ProfileUpdate): Promise<ProfileView>;
}

// Default privacy for each field when the caller does not specify one.
const DEFAULT_SENSITIVE: Record<ProfileFieldKey, boolean> = {
  email: false,
  phone: true,
  address: true,
  dob: true,
};

export class ProfileServiceImpl implements ProfileService {
  constructor(
    private readonly repositories: Repositories,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async getProfile(userId: string): Promise<ProfileView> {
    const [variants, fields] = await Promise.all([
      this.repositories.profiles.listNameVariants(userId),
      this.repositories.profiles.listProfileFields(userId),
    ]);

    const view: ProfileView = { names: {}, fields: {} };
    for (const variant of variants) {
      view.names[variant.kind] = variant.value;
    }
    for (const field of fields) {
      view.fields[field.key] = { value: field.value, sensitive: field.sensitive };
    }
    return view;
  }

  // Applies all provided name variants and fields in a single transaction.
  async updateProfile(userId: string, update: ProfileUpdate): Promise<ProfileView> {
    await this.unitOfWork.run(async (repos) => {
      for (const [kind, value] of Object.entries(update.names ?? {})) {
        if (value === undefined) continue;
        await repos.profiles.setNameVariant(userId, kind as NameVariantKind, value);
      }
      for (const [key, field] of Object.entries(update.fields ?? {})) {
        if (field === undefined) continue;
        const fieldKey = key as ProfileFieldKey;
        await repos.profiles.setProfileField(
          userId,
          fieldKey,
          field.value,
          field.sensitive ?? DEFAULT_SENSITIVE[fieldKey],
        );
      }
    });

    return this.getProfile(userId);
  }
}
