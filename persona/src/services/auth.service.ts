import { UnitOfWork } from '../domain/interfaces/unit-of-work';
import { UserRepository } from '../domain/interfaces/user.repository';
import { ConflictError, UnauthorizedError } from '../domain/errors';
import { User } from '../domain/models';
import { hashPassword, verifyPassword } from '../infrastructure/auth/password';

export interface AuthService {
  register(fullName: string, email: string, password: string): Promise<User>;
  login(email: string, password: string): Promise<User>;
}

export class AuthServiceImpl implements AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  // Creates the account and starts the vault with the essentials: the full
  // name and the sign-up email, both as defaults.
  async register(fullName: string, email: string, password: string): Promise<User> {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictError('An account with that email already exists', 'EMAIL_TAKEN');
    }
    const passwordHash = await hashPassword(password);

    return this.unitOfWork.run(async (repos) => {
      const user = await repos.users.create({ email, passwordHash });
      await repos.vault.create({
        userId: user.id,
        kind: 'name',
        value: fullName,
        nameContext: 'preferred',
        isDefault: true,
      });
      await repos.vault.create({ userId: user.id, kind: 'email', value: email, isDefault: true });
      return user;
    });
  }

  async login(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    return user;
  }
}
