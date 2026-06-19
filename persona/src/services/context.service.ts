import { DEFAULT_VARIANT, NAME_SCOPE, PURPOSE_VARIANT, SCOPE_FIELD } from '../constants/scopes';
import { ClientRepository } from '../domain/interfaces/client.repository';
import { ProfileRepository } from '../domain/interfaces/profile.repository';
import { NotFoundError } from '../domain/errors';
import { NameVariantKind, ProfileFieldKey } from '../domain/models';

export interface ResolveInput {
  names: Partial<Record<NameVariantKind, string>>;
  fields: Partial<Record<ProfileFieldKey, string>>;
  purpose: string;
  allowedScopes: string[];
  requestedScopes: string[];
  consentedScopes: string[];
}

export interface ResolvedClaims {
  context: string;
  scopesReleased: string[];
  claims: Record<string, string>;
}

// The data-minimisation core. Pure and side-effect free, so it is easy to test:
// it releases only scopes the client may request AND the user consented to, and
// resolves `name` to the variant appropriate for the client's purpose.
export function resolveClaims(input: ResolveInput): ResolvedClaims {
  const allowed = new Set(input.allowedScopes);
  const consented = new Set(input.consentedScopes);
  const effective = input.requestedScopes.filter((scope) => allowed.has(scope) && consented.has(scope));

  const claims: Record<string, string> = {};
  const scopesReleased: string[] = [];

  for (const scope of effective) {
    if (scope === NAME_SCOPE) {
      const variant = PURPOSE_VARIANT[input.purpose] ?? DEFAULT_VARIANT;
      const value = input.names[variant];
      if (value !== undefined) {
        claims.name = value;
        scopesReleased.push(NAME_SCOPE);
      }
      continue;
    }

    const fieldKey = SCOPE_FIELD[scope];
    if (fieldKey) {
      const value = input.fields[fieldKey];
      if (value !== undefined) {
        claims[fieldKey] = value;
        scopesReleased.push(scope);
      }
    }
  }

  return { context: input.purpose, scopesReleased, claims };
}

export interface ContextService {
  resolveForClient(
    userId: string,
    clientId: string,
    requestedScopes: string[],
    consentedScopes: string[],
  ): Promise<ResolvedClaims>;
}

export class ContextServiceImpl implements ContextService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly clients: ClientRepository,
  ) {}

  async resolveForClient(
    userId: string,
    clientId: string,
    requestedScopes: string[],
    consentedScopes: string[],
  ): Promise<ResolvedClaims> {
    const client = await this.clients.findById(clientId);
    if (!client) {
      throw new NotFoundError(`Unknown client: ${clientId}`, 'UNKNOWN_CLIENT');
    }

    const [variants, fields] = await Promise.all([
      this.profiles.listNameVariants(userId),
      this.profiles.listProfileFields(userId),
    ]);

    const names: Partial<Record<NameVariantKind, string>> = {};
    for (const variant of variants) {
      names[variant.kind] = variant.value;
    }
    const fieldMap: Partial<Record<ProfileFieldKey, string>> = {};
    for (const field of fields) {
      fieldMap[field.key] = field.value;
    }

    return resolveClaims({
      names,
      fields: fieldMap,
      purpose: client.purpose,
      allowedScopes: client.allowedScopes,
      requestedScopes,
      consentedScopes,
    });
  }
}
