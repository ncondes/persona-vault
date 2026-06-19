import { ProfileRepository } from '../src/domain/interfaces/profile.repository';
import { Repositories, UnitOfWork } from '../src/domain/interfaces/unit-of-work';
import { NameVariant, NameVariantKind, ProfileField, ProfileFieldKey } from '../src/domain/models';
import { ProfileServiceImpl } from '../src/services/profile.service';

// In-memory profile repository — no database needed.
class InMemoryProfileRepository implements ProfileRepository {
  private readonly variants = new Map<string, NameVariant>();
  private readonly fields = new Map<string, ProfileField>();

  async listNameVariants(userId: string): Promise<NameVariant[]> {
    return [...this.variants.values()].filter((v) => v.userId === userId);
  }

  async listProfileFields(userId: string): Promise<ProfileField[]> {
    return [...this.fields.values()].filter((f) => f.userId === userId);
  }

  async setNameVariant(userId: string, kind: NameVariantKind, value: string): Promise<NameVariant> {
    const variant: NameVariant = {
      id: `${userId}:${kind}`,
      userId,
      kind,
      value,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    this.variants.set(variant.id, variant);
    return variant;
  }

  async setProfileField(
    userId: string,
    key: ProfileFieldKey,
    value: string,
    sensitive: boolean,
  ): Promise<ProfileField> {
    const field: ProfileField = {
      id: `${userId}:${key}`,
      userId,
      key,
      value,
      sensitive,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    this.fields.set(field.id, field);
    return field;
  }
}

// Builds a service backed by in-memory repositories and a pass-through
// unit of work (runs the callback immediately, no real transaction).
function makeService() {
  const repositories = {
    users: {} as Repositories['users'],
    clients: {} as Repositories['clients'],
    profiles: new InMemoryProfileRepository(),
    consents: {} as Repositories['consents'],
    audit: {} as Repositories['audit'],
  } satisfies Repositories;

  const unitOfWork: UnitOfWork = { run: (work) => work(repositories) };

  return new ProfileServiceImpl(repositories, unitOfWork);
}

describe('ProfileService', () => {
  it('returns an empty profile for a new user', async () => {
    const service = makeService();
    const view = await service.getProfile('u1');
    expect(view).toEqual({ names: {}, fields: {} });
  });

  it('updates names and fields, then reads them back', async () => {
    const service = makeService();

    const view = await service.updateProfile('u1', {
      names: { legal: 'Jane Doe', public: 'Jane' },
      fields: { email: { value: 'jane@example.com' }, phone: { value: '123', sensitive: true } },
    });

    expect(view.names.legal).toBe('Jane Doe');
    expect(view.names.public).toBe('Jane');
    expect(view.fields.email).toEqual({ value: 'jane@example.com', sensitive: false }); // default
    expect(view.fields.phone).toEqual({ value: '123', sensitive: true });
  });

  it('merges partial updates instead of replacing the whole profile', async () => {
    const service = makeService();
    await service.updateProfile('u1', { names: { legal: 'Jane Doe' } });

    const view = await service.updateProfile('u1', { names: { public: 'Jane' } });

    expect(view.names.legal).toBe('Jane Doe'); // still there
    expect(view.names.public).toBe('Jane');
  });
});
