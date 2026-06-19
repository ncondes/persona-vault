import { CreateUserInput, UserRepository } from '../src/domain/interfaces/user.repository';
import { User } from '../src/domain/models';
import { AuthServiceImpl } from '../src/services/auth.service';

// In-memory fake — possible because the service depends on the UserRepository
// interface, not on Prisma. No database needed for these tests.
class FakeUserRepository implements UserRepository {
  private readonly users: User[] = [];

  async create(input: CreateUserInput): Promise<User> {
    const user: User = {
      id: String(this.users.length + 1),
      email: input.email,
      passwordHash: input.passwordHash,
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
}

describe('AuthService', () => {
  it('registers a user with a hashed password and logs them in', async () => {
    const service = new AuthServiceImpl(new FakeUserRepository());

    const user = await service.register('a@example.com', 'password123');
    expect(user.email).toBe('a@example.com');
    expect(user.passwordHash).not.toBe('password123');

    const loggedIn = await service.login('a@example.com', 'password123');
    expect(loggedIn.id).toBe(user.id);
  });

  it('rejects duplicate registration', async () => {
    const service = new AuthServiceImpl(new FakeUserRepository());
    await service.register('dup@example.com', 'password123');
    await expect(service.register('dup@example.com', 'password123')).rejects.toThrow();
  });

  it('rejects login with a wrong password', async () => {
    const service = new AuthServiceImpl(new FakeUserRepository());
    await service.register('b@example.com', 'password123');
    await expect(service.login('b@example.com', 'wrong-password')).rejects.toThrow();
  });

  it('rejects login for an unknown email', async () => {
    const service = new AuthServiceImpl(new FakeUserRepository());
    await expect(service.login('nobody@example.com', 'whatever')).rejects.toThrow();
  });
});
