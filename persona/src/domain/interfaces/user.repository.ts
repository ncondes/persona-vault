import { User } from '../models';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
}

export interface UserRepository {
  create(input: CreateUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}
