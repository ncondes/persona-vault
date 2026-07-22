import {
  CreateUserInput,
  UpdateSettingsInput,
  UserRepository,
} from '../src/domain/interfaces/user.repository';
import { CreateVaultItemInput } from '../src/domain/interfaces/vault.repository';
import { Repositories, UnitOfWork } from '../src/domain/interfaces/unit-of-work';
import { User } from '../src/domain/models';
import { AuthServiceImpl } from '../src/services/auth.service';

// In-memory fakes — possible because the service depends on interfaces, not on
// Prisma. No database needed for these tests.
class FakeUserRepository implements UserRepository {
  private readonly users: User[] = [];

  async create(input: CreateUserInput): Promise<User> {
    const user: User = {
      id: String(this.users.length + 1),
      email: input.email,
      passwordHash: input.passwordHash,
      confirmSensitive: true,
      notifyAccess: false,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    this.users.push(user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async updateSettings(userId: string, patch: UpdateSettingsInput): Promise<User> {
    const user = this.users.find((u) => u.id === userId)!;
    Object.assign(user, patch);
    return user;
  }

  async deleteById(userId: string): Promise<void> {
    const index = this.users.findIndex((u) => u.id === userId);
    if (index !== -1) this.users.splice(index, 1);
  }
}

function makeService() {
  const users = new FakeUserRepository();
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

    const user = await service.register('Ada Lovelace', 'a@example.com', 'password123');
    expect(user.email).toBe('a@example.com');
    expect(user.passwordHash).not.toBe('password123');

    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({ kind: 'name', value: 'Ada Lovelace', isDefault: true });
    expect(created[1]).toMatchObject({ kind: 'email', value: 'a@example.com', isDefault: true });

    const loggedIn = await service.login('a@example.com', 'password123');
    expect(loggedIn.id).toBe(user.id);
  });

  it('rejects duplicate registration', async () => {
    const { service } = makeService();
    await service.register('Dup', 'dup@example.com', 'password123');
    await expect(service.register('Dup', 'dup@example.com', 'password123')).rejects.toThrow();
  });

  it('rejects login with a wrong password', async () => {
    const { service } = makeService();
    await service.register('B', 'b@example.com', 'password123');
    await expect(service.login('b@example.com', 'wrong-password')).rejects.toThrow();
  });

  it('rejects login for an unknown email', async () => {
    const { service } = makeService();
    await expect(service.login('nobody@example.com', 'whatever')).rejects.toThrow();
  });
});
