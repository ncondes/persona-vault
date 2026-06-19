import { ClientRepository } from '../domain/interfaces/client.repository';
import { Client } from '../domain/models';
import { DbClient } from '../infrastructure/db/db-client';

export class PrismaClientRepository implements ClientRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string): Promise<Client | null> {
    return this.db.client.findUnique({ where: { id } });
  }

  list(): Promise<Client[]> {
    return this.db.client.findMany({ orderBy: { id: 'asc' } });
  }
}
