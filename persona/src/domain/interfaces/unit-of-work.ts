import { AuditRepository } from './audit.repository';
import { ClientRepository } from './client.repository';
import { ProfileRepository } from './profile.repository';
import { UserRepository } from './user.repository';

// The full set of repositories, all bound to a single database executor.
export interface Repositories {
  users: UserRepository;
  profiles: ProfileRepository;
  clients: ClientRepository;
  audit: AuditRepository;
}

// Runs a unit of work inside one database transaction: every repository call
// made through the provided `repos` shares the transaction and commits (or rolls
// back) together.
export interface UnitOfWork {
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}
