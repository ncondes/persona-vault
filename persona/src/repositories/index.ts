import { Repositories } from '../domain/interfaces/unit-of-work';
import { DbClient } from '../infrastructure/db/db-client';
import { PrismaAuditRepository } from './audit.repository';
import { PrismaClientRepository } from './client.repository';
import { PrismaProfileRepository } from './profile.repository';
import { PrismaUserRepository } from './user.repository';

// Builds the full set of repositories bound to one database executor — the base
// client for normal use, or a transaction client inside a unit of work.
export function createRepositories(db: DbClient): Repositories {
  return {
    users: new PrismaUserRepository(db),
    profiles: new PrismaProfileRepository(db),
    clients: new PrismaClientRepository(db),
    audit: new PrismaAuditRepository(db),
  };
}
