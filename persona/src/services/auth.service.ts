import { UserRepository } from '../domain/interfaces/user.repository';
import { ConflictError, UnauthorizedError } from '../domain/errors';
import { User } from '../domain/models';
import { hashPassword, verifyPassword } from '../infrastructure/auth/password';

export interface AuthService {
  register(email: string, password: string): Promise<User>;
  login(email: string, password: string): Promise<User>;
}

export class AuthServiceImpl implements AuthService {
  constructor(private readonly users: UserRepository) {}

  async register(email: string, password: string): Promise<User> {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictError('An account with that email already exists', 'EMAIL_TAKEN');
    }
    const passwordHash = await hashPassword(password);
    return this.users.create({ email, passwordHash });
  }

  async login(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    return user;
  }
}
