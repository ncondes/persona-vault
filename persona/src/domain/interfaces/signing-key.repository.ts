import { KeyState, SigningKey } from '../models';

export interface CreateSigningKeyInput {
  kid: string;
  alg: string;
  publicJwk: unknown;
  privateEncrypted: string;
  state: KeyState;
  // Written by the service rather than left to the column default. The publish
  // lead is measured from it, and the service is the thing holding the clock —
  // leaving it to the database would mean the schedule depended on two clocks
  // agreeing, which is only true by luck.
  createdAt: Date;
  activatedAt?: Date | null;
}

export interface SigningKeyRepository {
  // Every key that is still published, ordered active first. The order is load
  // bearing: oidc-provider signs with the first key matching the algorithm, so
  // whichever comes back first is the one that signs.
  listPublished(): Promise<SigningKey[]>;
  create(input: CreateSigningKeyInput): Promise<SigningKey>;
  setState(kid: string, state: KeyState, at: { activatedAt?: Date; retiresAt?: Date }): Promise<SigningKey>;
  // Drops keys whose retirement has passed. Returns how many went.
  deleteRetired(now: Date): Promise<number>;
  // Drops one key outright, whatever state it is in. For a key that must stop
  // being trusted now rather than at the end of its window.
  deleteByKid(kid: string): Promise<void>;
}
