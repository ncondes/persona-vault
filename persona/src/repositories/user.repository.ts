import {
  CreateUserInput,
  UpdateSettingsInput,
  UserRepository,
} from '../domain/interfaces/user.repository';
import { User } from '../domain/models';
import { DbClient } from '../infrastructure/db/db-client';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: DbClient) {}

  create(input: CreateUserInput): Promise<User> {
    return this.db.user.create({ data: input });
  }

  findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  updateSettings(userId: string, patch: UpdateSettingsInput): Promise<User> {
    return this.db.user.update({ where: { id: userId }, data: patch });
  }

  async deleteById(userId: string): Promise<void> {
    await this.db.user.delete({ where: { id: userId } });
  }
}
