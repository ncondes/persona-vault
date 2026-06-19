import { Client } from '../models';

export interface ClientRepository {
  findById(id: string): Promise<Client | null>;
  list(): Promise<Client[]>;
}
