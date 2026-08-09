import { AuditRepository } from './audit.repository';
import { ClientRepository } from './client.repository';
import { ConsentRepository } from './consent.repository';
import { OidcPayloadRepository } from './oidc-payload.repository';
import { OtpChallengeRepository } from './otp-challenge.repository';
import { UserRepository } from './user.repository';
import { VaultRepository } from './vault.repository';

// The full set of repositories, all bound to a single database executor.
export interface Repositories {
  users: UserRepository;
  vault: VaultRepository;
  clients: ClientRepository;
  consents: ConsentRepository;
  audit: AuditRepository;
  oidcPayloads: OidcPayloadRepository;
  otpChallenges: OtpChallengeRepository;
}

// Runs a unit of work inside one database transaction: every repository call
// made through the provided `repos` shares the transaction and commits (or rolls
// back) together.
export interface UnitOfWork {
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}
