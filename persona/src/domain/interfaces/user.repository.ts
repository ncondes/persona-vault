import { User } from '../models';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
}

export interface UpdateSettingsInput {
  confirmSensitive?: boolean;
  notifyAccess?: boolean;
}

export interface UserRepository {
  create(input: CreateUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  updateSettings(userId: string, patch: UpdateSettingsInput): Promise<User>;
  deleteById(userId: string): Promise<void>;
}
