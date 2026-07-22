import { DEFAULT_VARIANT, PURPOSE_VARIANT, SCOPE_KIND } from '../constants/scopes';
import { KIND_META } from '../constants/vault';
import { ClientRepository } from '../domain/interfaces/client.repository';
import { ConsentRepository } from '../domain/interfaces/consent.repository';
import { VaultRepository } from '../domain/interfaces/vault.repository';
import { NotFoundError } from '../domain/errors';
import {
  AddressDetail,
  ConsentSelection,
  DocumentDetail,
  NameDetail,
  VaultItem,
  VaultKind,
} from '../domain/models';

// What the consent screen shows for one requested scope: the user's candidate
// values, the context-suggested pick, and whether the vault lacks data for it.
export interface ScopeSuggestion {
  scope: string;
  kind: VaultKind;
  sensitive: boolean;
  missing: boolean;
  suggestedIds: string[];
  options: VaultItem[];
}

export interface ResolvedClaims {
  context: string;
  scopesReleased: string[];
  claims: Record<string, unknown>;
}

// Picks the item a client should get by default: for `name`, the context that
// matches the client's purpose (healthcare -> legal, social -> public, ...);
// for any other kind, the user's default value.
function pickSuggested(purpose: string, candidates: VaultItem[]): VaultItem[] {
  if (candidates.length === 0) return [];
  const kind = candidates[0].kind;
  if (kind === 'allergy') return candidates;
  if (kind === 'name') {
    const wanted = PURPOSE_VARIANT[purpose] ?? DEFAULT_VARIANT;
    const match = candidates.find((item) => item.nameContext === wanted);
    if (match) return [match];
  }
  return [candidates.find((item) => item.isDefault) ?? candidates[0]];
}

// The consent screen's pre-selection engine: for every requested scope the
// client may have, the options in the vault and the context-aware suggestion.
export function suggestSelections(
  purpose: string,
  allowedScopes: string[],
  requestedScopes: string[],
  items: VaultItem[],
): ScopeSuggestion[] {
  const allowed = new Set(allowedScopes);
  const suggestions: ScopeSuggestion[] = [];

  for (const scope of requestedScopes) {
    const kind = SCOPE_KIND[scope];
    if (!kind || !allowed.has(scope)) continue;

    const options = items.filter((item) => item.kind === kind);
    suggestions.push({
      scope,
      kind,
      sensitive: KIND_META[kind].sensitive,
      missing: options.length === 0,
      suggestedIds: pickSuggested(purpose, options).map((item) => item.id),
      options,
    });
  }

  return suggestions;
}

// Turns a vault item into the claim value for a scope. Documents and
// addresses become objects, given/family name release one part of the chosen
// name, everything else releases its plain value.
export function itemClaimValue(scope: string, item: VaultItem): unknown {
  if (scope === 'given_name') {
    return (item.detail as NameDetail | null)?.firstName ?? null;
  }
  if (scope === 'family_name') {
    return (item.detail as NameDetail | null)?.lastName ?? null;
  }
  if (item.kind === 'document') {
    const detail = item.detail as DocumentDetail | null;
    return {
      type: detail?.type ?? null,
      number: item.value,
      issueDate: detail?.issueDate ?? null,
      issuePlace: detail?.issuePlace ?? null,
    };
  }
  if (item.kind === 'address' && item.detail) {
    const detail = item.detail as AddressDetail;
    return {
      formatted: item.value,
      street: detail.street,
      city: detail.city,
      region: detail.region ?? null,
      postalCode: detail.postalCode ?? null,
      country: detail.country,
      details: detail.details ?? null,
    };
  }
  return item.value;
}

export interface ResolveInput {
  purpose: string;
  allowedScopes: string[];
  grantedScopes: string[];
  selections: ConsentSelection[];
  items: VaultItem[];
}

// The data-minimisation core: releases exactly what the user approved. Each
// granted scope resolves through its stored selection to the LIVE vault items,
// so later edits propagate and deleted items silently drop out. Scopes without
// a stored selection fall back to the context-aware suggestion.
export function resolveClaims(input: ResolveInput): ResolvedClaims {
  const allowed = new Set(input.allowedScopes);
  const byScope = new Map(input.selections.map((s) => [s.scope, s]));

  const claims: Record<string, unknown> = {};
  const scopesReleased: string[] = [];

  for (const scope of input.grantedScopes) {
    const kind = SCOPE_KIND[scope];
    if (!kind || !allowed.has(scope)) continue;

    const candidates = input.items.filter((item) => item.kind === kind);
    const selection = byScope.get(scope);
    const chosen = selection
      ? candidates.filter((item) => selection.itemIds.includes(item.id))
      : pickSuggested(input.purpose, candidates);
    if (chosen.length === 0) continue;

    if (kind === 'allergy') {
      claims[scope] = chosen.map((item) => item.value);
    } else {
      const value = itemClaimValue(scope, chosen[0]);
      if (value === null) continue;
      claims[scope] = value;
    }
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
    private readonly consents: ConsentRepository,
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

    const [items, consent] = await Promise.all([
      this.vault.listForUser(userId),
      this.consents.findByUserAndClient(userId, clientId),
    ]);

    return resolveClaims({
      purpose: client.purpose,
      allowedScopes: client.allowedScopes,
      grantedScopes,
      selections: consent?.selections ?? [],
      items,
    });
  }
}
