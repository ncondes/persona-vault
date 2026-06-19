import { buildContainer } from '../src/container';
import { prisma } from '../src/infrastructure/db/prisma';

// Integration tests: these talk to the real (Docker) database. Run with
// `npm run db:up` first, then `npm run test:int`.
describe('repositories (integration)', () => {
  const container = buildContainer();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reads a seeded client through the ClientRepository', async () => {
    const clinic = await container.repositories.clients.findById('clinic');

    expect(clinic).not.toBeNull();
    expect(clinic?.purpose).toBe('healthcare');
    expect(clinic?.allowedScopes).toContain('address');
  });

  it('writes across two tables atomically via the UnitOfWork', async () => {
    const email = 'tx-test@example.com';
    await prisma.user.deleteMany({ where: { email } });

    await container.unitOfWork.run(async (repos) => {
      const user = await repos.users.create({ email, passwordHash: 'x' });
      await repos.profiles.setNameVariant(user.id, 'public', 'TX Tester');
    });

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();

    const variants = await container.repositories.profiles.listNameVariants(user!.id);
    expect(variants.map((v) => v.kind)).toContain('public');

    await prisma.user.deleteMany({ where: { email } });
  });

  it('rolls back the whole transaction when it fails', async () => {
    const email = 'rollback-test@example.com';
    await prisma.user.deleteMany({ where: { email } });

    await expect(
      container.unitOfWork.run(async (repos) => {
        await repos.users.create({ email, passwordHash: 'x' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });
});
