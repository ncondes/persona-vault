import { DEFAULT_VARIANT, PURPOSE_VARIANT, SCOPE_KIND } from '../constants/scopes';
import { ClientRepository } from '../domain/interfaces/client.repository';
import { VaultRepository } from '../domain/interfaces/vault.repository';
import { NotFoundError } from '../domain/errors';
import { VaultItem } from '../domain/models';

export interface ResolveDefaultsInput {
  purpose: string;
  allowedScopes: string[];
  grantedScopes: string[];
  items: VaultItem[];
}

export interface ResolvedClaims {
  context: string;
  scopesReleased: string[];
  claims: Record<string, unknown>;
}

// Picks the vault item that backs a scope when the user made no explicit
// choice: for `name`, the context matching the client's purpose; for any other
// kind, the default value.
export function pickDefaultItem(
  scope: string,
  purpose: string,
  candidates: VaultItem[],
): VaultItem | undefined {
  if (candidates.length === 0) return undefined;
  if (scope === 'name') {
    const wanted = PURPOSE_VARIANT[purpose] ?? DEFAULT_VARIANT;
    const match = candidates.find((item) => item.nameContext === wanted);
    if (match) return match;
  }
  return candidates.find((item) => item.isDefault) ?? candidates[0];
}

// Turns a vault item into the claim value for its scope. A document becomes an
// object (number + detail); every other kind releases its plain value.
export function itemClaimValue(item: VaultItem): unknown {
  if (item.kind === 'document') {
    return {
      type: item.detail?.type ?? null,
      number: item.value,
      issueDate: item.detail?.issueDate ?? null,
      issuePlace: item.detail?.issuePlace ?? null,
    };
  }
  return item.value;
}

// The data-minimisation core: releases only scopes the client may request,
// resolved from the vault's default values. `allergies` releases every allergy
// item as a list.
export function resolveDefaultClaims(input: ResolveDefaultsInput): ResolvedClaims {
  const allowed = new Set(input.allowedScopes);
  const effective = input.grantedScopes.filter((scope) => allowed.has(scope));

  const claims: Record<string, unknown> = {};
  const scopesReleased: string[] = [];

  for (const scope of effective) {
    const kind = SCOPE_KIND[scope];
    if (!kind) continue;
    const candidates = input.items.filter((item) => item.kind === kind);
    if (candidates.length === 0) continue;

    if (kind === 'allergy') {
      claims[scope] = candidates.map((item) => item.value);
      scopesReleased.push(scope);
      continue;
    }

    const item = pickDefaultItem(scope, input.purpose, candidates);
    if (!item) continue;
    claims[scope] = itemClaimValue(item);
    scopesReleased.push(scope);
  }

  return { context: input.purpose, scopesReleased, claims };
}

export interface ContextService {
  resolveForClient(
    userId: string,
    clientId: string,
    grantedScopes: string[],
  ): Promise<ResolvedClaims>;
}

export class ContextServiceImpl implements ContextService {
  constructor(
    private readonly vault: VaultRepository,
    private readonly clients: ClientRepository,
  ) {}

  async resolveForClient(
    userId: string,
    clientId: string,
    grantedScopes: string[],
  ): Promise<ResolvedClaims> {
    const client = await this.clients.findById(clientId);
    if (!client) {
      throw new NotFoundError(`Unknown client: ${clientId}`, 'UNKNOWN_CLIENT');
    }

    const items = await this.vault.listForUser(userId);
    return resolveDefaultClaims({
      purpose: client.purpose,
      allowedScopes: client.allowedScopes,
      grantedScopes,
      items,
    });
  }
}
