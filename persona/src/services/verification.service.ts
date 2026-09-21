import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  CHALLENGE_BYTES,
  CHALLENGE_MAX_BYTES,
  CHALLENGE_PATH,
  CHALLENGE_TIMEOUT_MS,
  CHALLENGE_TTL_MS,
} from '../constants/verification';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors';
import { ClientRepository } from '../domain/interfaces/client.repository';
import { Client } from '../domain/models';
import { UnsafeTargetError, fetchChallenge } from '../infrastructure/http/challenge-fetch';

export interface VerificationChallenge {
  domain: string;
  url: string;
  token: string;
  expiresAt: Date;
}

export interface VerificationResult {
  verified: boolean;
  domain: string;
  reason?: string;
}

// The host every redirect URI has to share. Verification is about the place the
// browser is sent back to, so it is that place that has to be proved — and if a
// client registers redirect URIs on two different hosts, there is no single
// answer to give the person on the consent screen.
export function redirectHost(client: Client): string {
  const hosts = new Set<string>();
  for (const uri of client.redirectUris) {
    try {
      hosts.add(new URL(uri).hostname.toLowerCase());
    } catch {
      throw new ValidationError('A redirect URI is not a valid URL');
    }
  }
  if (hosts.size === 0) {
    throw new ValidationError('Register a redirect URI before verifying the domain');
  }
  if (hosts.size > 1) {
    throw new ConflictError(
      'Every redirect URI must be on the same domain before it can be verified',
      'REDIRECT_URIS_DIFFER',
    );
  }
  return [...hosts][0];
}

function matches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class VerificationService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly fetcher = fetchChallenge,
    private readonly now: () => number = Date.now,
  ) {}

  // Hands the developer a token and the URL to serve it at.
  async issue(client: Client): Promise<VerificationChallenge> {
    const domain = redirectHost(client);
    const token = randomBytes(CHALLENGE_BYTES).toString('base64url');
    const issuedAt = new Date(this.now());

    await this.clients.update(client.id, {
      verificationToken: token,
      verificationIssuedAt: issuedAt,
    });

    return {
      domain,
      url: `https://${domain}${CHALLENGE_PATH}`,
      token,
      expiresAt: new Date(issuedAt.getTime() + CHALLENGE_TTL_MS),
    };
  }

  // Goes and looks. On success the domain is recorded, not the claim.
  async check(client: Client): Promise<VerificationResult> {
    const domain = redirectHost(client);

    if (!client.verificationToken || !client.verificationIssuedAt) {
      throw new NotFoundError('Start a verification before checking it', 'NO_CHALLENGE');
    }
    if (this.now() - client.verificationIssuedAt.getTime() > CHALLENGE_TTL_MS) {
      throw new ConflictError('That verification has expired. Start another.', 'CHALLENGE_EXPIRED');
    }

    let response;
    try {
      response = await this.fetcher(new URL(`https://${domain}${CHALLENGE_PATH}`), {
        timeoutMs: CHALLENGE_TIMEOUT_MS,
        maxBytes: CHALLENGE_MAX_BYTES,
      });
    } catch (err) {
      if (err instanceof UnsafeTargetError) {
        return { verified: false, domain, reason: err.message };
      }
      throw err;
    }

    if (response.status !== 200) {
      return { verified: false, domain, reason: `the challenge URL answered ${response.status}` };
    }
    if (!matches(client.verificationToken, response.body.trim())) {
      return { verified: false, domain, reason: 'the challenge URL served a different token' };
    }

    await this.clients.update(client.id, {
      verifiedDomain: domain,
      verifiedAt: new Date(this.now()),
      verificationToken: null,
      verificationIssuedAt: null,
    });
    return { verified: true, domain };
  }

  // Called when the redirect URIs change. A domain proved for one set of URIs
  // says nothing about another, and leaving the badge up would be the one
  // failure mode that matters: an unverified app looking verified.
  async clear(clientId: string): Promise<void> {
    await this.clients.update(clientId, {
      verifiedDomain: null,
      verifiedAt: null,
      verificationToken: null,
      verificationIssuedAt: null,
    });
  }
}
