import {
  CreateVaultItemInput,
  UpdateVaultItemInput,
  VaultRepository,
} from '../src/domain/interfaces/vault.repository';
import { Repositories, UnitOfWork } from '../src/domain/interfaces/unit-of-work';
import { VaultItem, VaultKind } from '../src/domain/models';
import { VaultServiceImpl } from '../src/services/vault.service';

// In-memory fake — possible because the service depends on the VaultRepository
// interface, not on Prisma. No database needed for these tests.
class InMemoryVaultRepository implements VaultRepository {
  private readonly items: VaultItem[] = [];
  private counter = 0;

  async listForUser(userId: string): Promise<VaultItem[]> {
    return this.items.filter((i) => i.userId === userId);
  }

  async listByKind(userId: string, kind: VaultKind): Promise<VaultItem[]> {
    return this.items.filter((i) => i.userId === userId && i.kind === kind);
  }

  async findByIds(userId: string, ids: string[]): Promise<VaultItem[]> {
    return this.items.filter((i) => i.userId === userId && ids.includes(i.id));
  }

  async create(input: CreateVaultItemInput): Promise<VaultItem> {
    this.counter += 1;
    const item: VaultItem = {
      id: `item-${this.counter}`,
      userId: input.userId,
      kind: input.kind,
      label: input.label ?? null,
      value: input.value,
      detail: input.detail ?? null,
      isDefault: input.isDefault ?? false,
      nameContext: input.nameContext ?? null,
      createdAt: new Date(this.counter),
      updatedAt: new Date(this.counter),
    };
    this.items.push(item);
    return item;
  }

  async update(userId: string, id: string, patch: UpdateVaultItemInput): Promise<VaultItem> {
    const item = this.items.find((i) => i.userId === userId && i.id === id);
    if (!item) throw new Error('not found');
    Object.assign(
      item,
      Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    );
    return item;
  }

  async delete(userId: string, id: string): Promise<void> {
    const index = this.items.findIndex((i) => i.userId === userId && i.id === id);
    if (index === -1) throw new Error('not found');
    this.items.splice(index, 1);
  }

  async clearDefault(userId: string, kind: VaultKind): Promise<void> {
    for (const item of this.items) {
      if (item.userId === userId && item.kind === kind) item.isDefault = false;
    }
  }
}

function makeService() {
  const vault = new InMemoryVaultRepository();
  const repos = { vault } as unknown as Repositories;
  const unitOfWork: UnitOfWork = { run: (work) => work(repos) };
  return new VaultServiceImpl(repos, unitOfWork);
}

const USER = 'user-1';

describe('VaultService', () => {
  it('makes the first value of a kind the default automatically', async () => {
    const service = makeService();
    const item = await service.addItem(USER, { kind: 'email', value: 'a@example.com' });
    expect(item.isDefault).toBe(true);
  });

  it('setting a new default clears the previous one', async () => {
    const service = makeService();
    await service.addItem(USER, { kind: 'email', value: 'a@example.com' });
    await service.addItem(USER, { kind: 'email', value: 'b@example.com', isDefault: true });

    const items = await service.list(USER);
    const defaults = items.filter((i) => i.isDefault).map((i) => i.value);
    expect(defaults).toEqual(['b@example.com']);
  });

  it('promoting via update switches the default', async () => {
    const service = makeService();
    await service.addItem(USER, { kind: 'email', value: 'a@example.com' });
    const second = await service.addItem(USER, { kind: 'email', value: 'b@example.com' });

    await service.updateItem(USER, second.id, { isDefault: true });

    const items = await service.list(USER);
    expect(items.find((i) => i.value === 'a@example.com')?.isDefault).toBe(false);
    expect(items.find((i) => i.value === 'b@example.com')?.isDefault).toBe(true);
  });

  it('rejects a second value for a single-value kind', async () => {
    const service = makeService();
    await service.addItem(USER, { kind: 'blood_type', value: 'O_POS' });
    await expect(service.addItem(USER, { kind: 'blood_type', value: 'A_NEG' })).rejects.toThrow(
      /one blood_type value/i,
    );
  });

  it('rejects a blood type that is not a catalog code', async () => {
    const service = makeService();
    await expect(
      service.addItem(USER, { kind: 'blood_type', value: 'purple' }),
    ).rejects.toMatchObject({ fields: { value: expect.stringMatching(/must be one of/i) } });
  });

  it('requires a detail block on documents and rejects it elsewhere', async () => {
    const service = makeService();
    await expect(service.addItem(USER, { kind: 'document', value: '123' })).rejects.toMatchObject({
      fields: { detail: expect.stringMatching(/needs its detail/i) },
    });
    await expect(
      service.addItem(USER, {
        kind: 'email',
        value: 'a@example.com',
        detail: { type: 'CC', issueDate: '2020-01-01', issuePlace: 'Bogotá' },
      }),
    ).rejects.toMatchObject({ fields: { detail: expect.stringMatching(/does not carry/i) } });
  });

  it('rejects a name context on a non-name kind', async () => {
    const service = makeService();
    await expect(
      service.addItem(USER, { kind: 'email', value: 'a@example.com', nameContext: 'legal' }),
    ).rejects.toMatchObject({ fields: { nameContext: expect.stringMatching(/only name items/i) } });
  });

  it('composes a name from its parts and requires both', async () => {
    const service = makeService();
    const item = await service.addItem(USER, {
      kind: 'name',
      detail: { firstName: 'Ada', lastName: 'Lovelace' },
      nameContext: 'legal',
    });
    expect(item.value).toBe('Ada Lovelace');

    await expect(
      service.addItem(USER, { kind: 'name', detail: { firstName: 'Solo', lastName: '' } }),
    ).rejects.toMatchObject({ fields: { 'detail.lastName': expect.any(String) } });
  });

  it('composes a phone from its dial code and validates the prefix', async () => {
    const service = makeService();
    const item = await service.addItem(USER, {
      kind: 'phone',
      detail: { countryCode: '+57', number: '300 111 2233' },
    });
    expect(item.value).toBe('+57 300 111 2233');

    await expect(
      service.addItem(USER, { kind: 'phone', detail: { countryCode: '+999', number: '1' } }),
    ).rejects.toMatchObject({ fields: { 'detail.countryCode': expect.any(String) } });
  });

  it('composes an address and requires line1, city and a known country', async () => {
    const service = makeService();
    const item = await service.addItem(USER, {
      kind: 'address',
      detail: { line1: 'Cra 7 # 45-10', city: 'Bogotá', country: 'CO' },
    });
    expect(item.value).toBe('Cra 7 # 45-10, Bogotá');

    await expect(
      service.addItem(USER, { kind: 'address', detail: { line1: '', city: '', country: 'CO' } }),
    ).rejects.toMatchObject({ fields: { 'detail.line1': expect.any(String) } });
  });

  it('deleting the default promotes the oldest remaining value', async () => {
    const service = makeService();
    const first = await service.addItem(USER, { kind: 'email', value: 'a@example.com' });
    await service.addItem(USER, { kind: 'email', value: 'b@example.com' });
    await service.addItem(USER, { kind: 'email', value: 'c@example.com' });

    await service.removeItem(USER, first.id);

    const items = await service.list(USER);
    expect(items.map((i) => i.value)).toEqual(['b@example.com', 'c@example.com']);
    expect(items.find((i) => i.value === 'b@example.com')?.isDefault).toBe(true);
  });

  // Per-kind rules, as a table. Every entry names the field the error must be
  // filed under, because the vault form maps those keys straight onto its inputs
  // — an error under the wrong key shows up next to the wrong box.
  describe('per-kind validation', () => {
    it.each([
      ['a blood type outside the catalog', { kind: 'blood_type', value: 'XY+' }, 'value'],
      ['an EPS outside the catalog', { kind: 'eps', value: 'NOT_AN_EPS' }, 'value'],
      ['a birth date that is not ISO', { kind: 'birth_date', value: '02/04/1998' }, 'value'],
      ['a birth date with a bad month', { kind: 'birth_date', value: '1998-13-01' }, 'value'],
      ['a birth date with a bad day', { kind: 'birth_date', value: '1998-04-31' }, 'value'],
      ['29 February in a common year', { kind: 'birth_date', value: '1997-02-29' }, 'value'],
      ['an email with no @', { kind: 'email', value: 'not-an-email' }, 'value'],
      [
        'a name missing its first name',
        { kind: 'name', detail: { firstName: '', lastName: 'García' } },
        'detail.firstName',
      ],
      [
        'a name missing its last name',
        { kind: 'name', detail: { firstName: 'Camila', lastName: '' } },
        'detail.lastName',
      ],
      [
        'a phone with an unknown dial code',
        { kind: 'phone', detail: { countryCode: '+999', number: '3001234567' } },
        'detail.countryCode',
      ],
      [
        'a phone with no number',
        { kind: 'phone', detail: { countryCode: '+57', number: '' } },
        'detail.number',
      ],
      [
        'an address with no city',
        { kind: 'address', detail: { line1: 'Cra 7', city: '', country: 'CO' } },
        'detail.city',
      ],
      [
        'an address with an unknown country',
        { kind: 'address', detail: { line1: 'Cra 7', city: 'Bogotá', country: 'ZZ' } },
        'detail.country',
      ],
      [
        'a document type outside the catalog',
        {
          kind: 'document',
          value: '1020304050',
          detail: { type: 'NOPE', issueDate: '2015-04-02', issuePlace: 'Bogotá' },
        },
        'detail.type',
      ],
      [
        'a document with a malformed issue date',
        {
          kind: 'document',
          value: '1020304050',
          detail: { type: 'CC', issueDate: '02-04-2015', issuePlace: 'Bogotá' },
        },
        'detail.issueDate',
      ],
      [
        'a document with no issue place',
        {
          kind: 'document',
          value: '1020304050',
          detail: { type: 'CC', issueDate: '2015-04-02', issuePlace: '' },
        },
        'detail.issuePlace',
      ],
      [
        'a document with no detail at all',
        { kind: 'document', value: '1020304050' },
        'detail',
      ],
    ])('rejects %s under "%s"', async (_label, input, field) => {
      const service = makeService();
      await expect(
        service.addItem(USER, input as Parameters<typeof service.addItem>[1]),
      ).rejects.toMatchObject({ fields: { [field as string]: expect.any(String) } });
    });

    it.each([
      ['a catalog blood type', { kind: 'blood_type', value: 'O_POS' }],
      ['a catalog EPS', { kind: 'eps', value: 'SANITAS' }],
      ['an ISO birth date', { kind: 'birth_date', value: '1998-04-02' }],
      ['29 February in a leap year', { kind: 'birth_date', value: '1996-02-29' }],
      ['a plausible email', { kind: 'email', value: 'camila@example.com' }],
      [
        'a full document',
        {
          kind: 'document',
          value: '1020304050',
          detail: { type: 'CC', issueDate: '2015-04-02', issuePlace: 'Bogotá' },
        },
      ],
    ])('accepts %s', async (_label, input) => {
      const service = makeService();
      await expect(
        service.addItem(USER, input as Parameters<typeof service.addItem>[1]),
      ).resolves.toBeDefined();
    });

    // Validation runs against the stored kind, so a patch cannot smuggle a value
    // past the rule for the item it is editing.
    it('applies the same rules to an update', async () => {
      const service = makeService();
      const item = await service.addItem(USER, { kind: 'blood_type', value: 'O_POS' });

      await expect(service.updateItem(USER, item.id, { value: 'XY+' })).rejects.toMatchObject({
        fields: { value: expect.any(String) },
      });
      await expect(service.updateItem(USER, item.id, { value: 'A_NEG' })).resolves.toMatchObject({
        value: 'A_NEG',
      });
    });

    it('reports every broken rule at once rather than the first', async () => {
      const service = makeService();

      await expect(
        service.addItem(USER, {
          kind: 'address',
          detail: { line1: '', city: '', country: 'ZZ' },
        }),
      ).rejects.toMatchObject({
        fields: {
          'detail.line1': expect.any(String),
          'detail.city': expect.any(String),
          'detail.country': expect.any(String),
        },
      });
    });
  });

  describe('missing items', () => {
    it('reports an update to an item that is not there', async () => {
      await expect(makeService().updateItem(USER, 'nope', { value: 'x' })).rejects.toThrow();
    });

    it('reports a delete of an item that is not there', async () => {
      await expect(makeService().removeItem(USER, 'nope')).rejects.toThrow();
    });

    // Ownership is part of the lookup, so another user's id is simply not found.
    it('will not let one user edit another user’s item', async () => {
      const service = makeService();
      const mine = await service.addItem(USER, { kind: 'email', value: 'a@example.com' });

      await expect(service.updateItem('someone-else', mine.id, { value: 'b@x.co' })).rejects.toThrow();
      await expect(service.removeItem('someone-else', mine.id)).rejects.toThrow();
    });
  });
});
