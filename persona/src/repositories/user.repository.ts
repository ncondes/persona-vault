import { CreateUserInput, UserRepository } from '../domain/interfaces/user.repository';
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
}
