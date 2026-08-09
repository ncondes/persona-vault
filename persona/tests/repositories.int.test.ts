import { buildContainer } from '../src/container';
import { prisma } from '../src/infrastructure/db/prisma';

// Integration tests: these talk to the real (Docker) database. Run with
// `npm run db:up` first, then `npm run test:int`.
describe('repositories (integration)', () => {
  const container = buildContainer();

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'repo-int-' } } });
    await prisma.$disconnect();
  });

  async function makeUser(tag: string): Promise<string> {
    const email = `repo-int-${tag}-${Date.now()}@example.com`;
    const user = await container.repositories.users.create({ email, passwordHash: 'x' });
    return user.id;
  }

  it('reads a seeded client with its required scopes', async () => {
    const clinic = await container.repositories.clients.findById('clinic');

    expect(clinic).not.toBeNull();
    expect(clinic?.purpose).toBe('healthcare');
    expect(clinic?.allowedScopes).toContain('eps');
    expect(clinic?.requiredScopes).toContain('document');
  });

  it('creates, lists, updates and deletes vault items', async () => {
    const userId = await makeUser('crud');
    const vault = container.repositories.vault;

    const personal = await vault.create({
      userId,
      kind: 'email',
      label: 'Personal',
      value: 'personal@example.com',
      isDefault: true,
    });
    const work = await vault.create({
      userId,
      kind: 'email',
      label: 'Work',
      value: 'work@example.com',
    });

    let emails = await vault.listByKind(userId, 'email');
    expect(emails).toHaveLength(2);
    expect(emails.find((i) => i.id === personal.id)?.isDefault).toBe(true);

    const updated = await vault.update(userId, work.id, { value: 'work2@example.com' });
    expect(updated.value).toBe('work2@example.com');

    await vault.delete(userId, personal.id);
    emails = await vault.listByKind(userId, 'email');
    expect(emails.map((i) => i.id)).toEqual([work.id]);
  });

  it('clearDefault removes the default flag so a new default can be set', async () => {
    const userId = await makeUser('default');
    const vault = container.repositories.vault;

    const first = await vault.create({
      userId,
      kind: 'phone',
      value: '111',
      isDefault: true,
    });
    const second = await vault.create({ userId, kind: 'phone', value: '222' });

    await vault.clearDefault(userId, 'phone');
    await vault.update(userId, second.id, { isDefault: true });

    const phones = await vault.listByKind(userId, 'phone');
    expect(phones.find((i) => i.id === first.id)?.isDefault).toBe(false);
    expect(phones.find((i) => i.id === second.id)?.isDefault).toBe(true);
  });

  it('stores document detail and consent selections as JSON, round-tripping intact', async () => {
    const userId = await makeUser('json');
    const vault = container.repositories.vault;

    const doc = await vault.create({
      userId,
      kind: 'document',
      value: '1032456789',
      detail: { type: 'CC', issueDate: '2012-09-01', issuePlace: 'Bogotá D.C.' },
      isDefault: true,
    });
    const found = await vault.findByIds(userId, [doc.id]);
    expect(found[0].detail?.type).toBe('CC');
    expect(found[0].detail?.issuePlace).toBe('Bogotá D.C.');

    const consent = await container.repositories.consents.record({
      userId,
      clientId: 'clinic',
      scopes: ['openid', 'document'],
      selections: [
        {
          scope: 'document',
          itemIds: [doc.id],
          snapshot: [{ label: null, value: doc.value, detail: doc.detail }],
        },
      ],
      grantId: 'grant-json-1',
    });
    expect(consent.selections[0].itemIds).toEqual([doc.id]);

    const reloaded = await container.repositories.consents.findByUserAndClient(userId, 'clinic');
    expect(reloaded?.selections[0].snapshot[0].detail?.type).toBe('CC');
  });

  it('writes across two tables atomically via the UnitOfWork', async () => {
    const email = `repo-int-tx-${Date.now()}@example.com`;

    await container.unitOfWork.run(async (repos) => {
      const user = await repos.users.create({ email, passwordHash: 'x' });
      await repos.vault.create({ userId: user.id, kind: 'username', value: 'txtester' });
    });

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();

    const items = await container.repositories.vault.listByKind(user!.id, 'username');
    expect(items.map((i) => i.value)).toContain('txtester');
  });

  it('rolls back the whole transaction when it fails', async () => {
    const email = `repo-int-rollback-${Date.now()}@example.com`;

    await expect(
      container.unitOfWork.run(async (repos) => {
        await repos.users.create({ email, passwordHash: 'x' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });

  // Both writes filter on userId as well as id, so "not mine" and "not there"
  // are the same answer. That is what stops one person editing another's vault
  // by guessing an id.
  describe('ownership is part of the lookup', () => {
    let mineId: string;
    let ownerId: string;
    const strangerId = '00000000-0000-0000-0000-000000000000';

    beforeAll(async () => {
      const user = await prisma.user.findFirst({ where: { email: { startsWith: 'repo-int-' } } });
      ownerId = user!.id;
      const item = await container.repositories.vault.create({
        userId: ownerId,
        kind: 'email',
        value: 'owned@example.com',
      });
      mineId = item.id;
    });

    it.each([
      ['an id that does not exist', () => 'no-such-id', () => ownerId],
      ['someone else’s item', () => mineId, () => strangerId],
    ])('refuses to update %s', async (_label, id, userId) => {
      await expect(
        container.repositories.vault.update(userId(), id(), { value: 'hijacked' }),
      ).rejects.toMatchObject({ code: 'VAULT_ITEM_NOT_FOUND' });
    });

    it.each([
      ['an id that does not exist', () => 'no-such-id', () => ownerId],
      ['someone else’s item', () => mineId, () => strangerId],
    ])('refuses to delete %s', async (_label, id, userId) => {
      await expect(
        container.repositories.vault.delete(userId(), id()),
      ).rejects.toMatchObject({ code: 'VAULT_ITEM_NOT_FOUND' });
    });

    it('leaves the item untouched after all those attempts', async () => {
      const [item] = await container.repositories.vault.findByIds(ownerId, [mineId]);
      expect(item.value).toBe('owned@example.com');
    });
  });
});
