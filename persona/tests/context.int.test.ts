import { buildContainer } from '../src/container';
import { prisma } from '../src/infrastructure/db/prisma';

// Resolves claims against the real database using the seeded clinic/forum
// clients and a freshly created test user.
describe('context engine (integration)', () => {
  const container = buildContainer();
  const email = `context-int-${Date.now()}@example.com`;
  let userId = '';

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await container.unitOfWork.run(async (repos) => {
      const user = await repos.users.create({ email, passwordHash: 'x' });
      userId = user.id;
      await repos.profiles.setNameVariant(user.id, 'legal', 'Legal Name');
      await repos.profiles.setNameVariant(user.id, 'public', 'Public Name');
      await repos.profiles.setProfileField(user.id, 'email', 'ctx@example.com', false);
      await repos.profiles.setProfileField(user.id, 'phone', '12345', true);
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('clinic (healthcare) receives the legal name + consented fields', async () => {
    const out = await container.contextService.resolveForClient(
      userId,
      'clinic',
      ['name', 'email', 'phone'],
      ['name', 'email', 'phone'],
    );
    expect(out.claims.name).toBe('Legal Name');
    expect(out.claims.email).toBe('ctx@example.com');
    expect(out.claims.phone).toBe('12345');
  });

  it('forum (social) only receives the public name', async () => {
    const out = await container.contextService.resolveForClient(
      userId,
      'forum',
      ['name', 'email', 'phone'], // forum is only allowed `name`
      ['name', 'email', 'phone'],
    );
    expect(out.claims.name).toBe('Public Name');
    expect(out.claims).not.toHaveProperty('email');
    expect(out.claims).not.toHaveProperty('phone');
  });

  it('throws for an unknown client', async () => {
    await expect(
      container.contextService.resolveForClient(userId, 'does-not-exist', ['name'], ['name']),
    ).rejects.toThrow();
  });
});
