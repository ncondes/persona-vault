import { Consent } from '../models';

export interface RecordConsentInput {
  userId: string;
  clientId: string;
  scopes: string[];
  grantId: string;
}

export interface ConsentRepository {
  // Inserts or updates the user's standing consent for a client.
  record(input: RecordConsentInput): Promise<Consent>;
  listForUser(userId: string): Promise<Consent[]>;
  findByUserAndClient(userId: string, clientId: string): Promise<Consent | null>;
  deleteByUserAndClient(userId: string, clientId: string): Promise<void>;
}
