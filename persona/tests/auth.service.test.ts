import { CreateVaultItemInput } from '../src/domain/interfaces/vault.repository';
import { Repositories, UnitOfWork } from '../src/domain/interfaces/unit-of-work';
import { AuthServiceImpl } from '../src/services/auth.service';
import { FakeUsers } from './support/fakes';

// The service depends on interfaces, not on Prisma, so in-memory fakes are
// enough. No database needed for these tests.
function makeService() {
  const users = new FakeUsers();
  // A recording stub rather than FakeVault: these tests assert on the exact
  // input the service passes, not on what ends up stored.
  const created: CreateVaultItemInput[] = [];
  const repos = {
    users,
    vault: {
      create: async (input: CreateVaultItemInput) => {
        created.push(input);
        return input as never;
      },
    },
  } as unknown as Repositories;
  const unitOfWork: UnitOfWork = { run: (work) => work(repos) };
  return { service: new AuthServiceImpl(users, unitOfWork), created };
}

describe('AuthService', () => {
  it('registers a user with a hashed password and starts the vault', async () => {
    const { service, created } = makeService();

    const user = await service.register('Ada', 'Lovelace', 'a@example.com', 'password123');
    expect(user.email).toBe('a@example.com');
    expect(user.passwordHash).not.toBe('password123');

    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({
      kind: 'name',
      value: 'Ada Lovelace',
      detail: { firstName: 'Ada', lastName: 'Lovelace' },
      isDefault: true,
    });
    expect(created[1]).toMatchObject({ kind: 'email', value: 'a@example.com', isDefault: true });

    const loggedIn = await service.login('a@example.com', 'password123');
    expect(loggedIn.id).toBe(user.id);
  });

  it('rejects duplicate registration', async () => {
    const { service } = makeService();
    await service.register('Dup', 'User', 'dup@example.com', 'password123');
    await expect(
      service.register('Dup', 'User', 'dup@example.com', 'password123'),
    ).rejects.toThrow();
  });

  it('rejects login with a wrong password', async () => {
    const { service } = makeService();
    await service.register('B', 'User', 'b@example.com', 'password123');
    await expect(service.login('b@example.com', 'wrong-password')).rejects.toThrow();
  });

  it('rejects login for an unknown email', async () => {
    const { service } = makeService();
    await expect(service.login('nobody@example.com', 'whatever')).rejects.toThrow();
  });
});
