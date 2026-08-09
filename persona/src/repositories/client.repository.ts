import {
  ClientRepository,
  SaveClientInput,
  UpdateClientInput,
} from '../domain/interfaces/client.repository';
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

  listByOwner(ownerId: string): Promise<Client[]> {
    return this.db.client.findMany({ where: { ownerId }, orderBy: { createdAt: 'asc' } });
  }

  upsert(input: SaveClientInput): Promise<Client> {
    const { id, ...rest } = input;
    return this.db.client.upsert({ where: { id }, create: { id, ...rest }, update: rest });
  }

  update(id: string, patch: UpdateClientInput): Promise<Client> {
    return this.db.client.update({ where: { id }, data: patch });
  }

  async delete(id: string): Promise<void> {
    await this.db.client.deleteMany({ where: { id } });
  }
}
