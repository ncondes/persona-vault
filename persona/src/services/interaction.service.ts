import { AppError, NotFoundError } from '../domain/errors';
import { Repositories } from '../domain/interfaces/unit-of-work';
import { ConsentSelection, DocumentDetail, NameContext, VaultItem } from '../domain/models';
import { suggestSelections } from './context.service';

export interface InteractionOption {
  id: string;
  label: string | null;
  value: string;
  detail: DocumentDetail | null;
  isDefault: boolean;
  nameContext: NameContext | null;
}

export interface InteractionField {
  scope: string;
  kind: string;
  required: boolean;
  sensitive: boolean;
  missing: boolean;
  suggestedIds: string[];
  options: InteractionOption[];
}

export interface ConsentDetails {
  uid: string;
  prompt: 'consent';
  client: { id: string; name: string; purpose: string };
  settings: { confirmSensitive: boolean };
  fields: InteractionField[];
}

export interface DecisionInput {
  selections?: Record<string, string[]>;
  excludedScopes?: string[];
}

export interface AppliedDecision {
  purpose: string;
  grantedScopes: string[];
  rejectedScopes: string[];
  selections: ConsentSelection[];
}

function toOption(item: VaultItem): InteractionOption {
  return {
    id: item.id,
    label: item.label,
    value: item.value,
    detail: item.detail,
    isDefault: item.isDefault,
    nameContext: item.nameContext,
  };
}

// Builds the consent screen payload and validates the user's decision. The
// OIDC provider objects (interaction, grant) stay in the route layer.
export class InteractionService {
  constructor(private readonly repositories: Repositories) {}

  private async loadClient(clientId: string) {
    const client = await this.repositories.clients.findById(clientId);
    if (!client) {
      throw new NotFoundError(`Unknown client: ${clientId}`, 'UNKNOWN_CLIENT');
    }
    return client;
  }

  async consentDetails(
    uid: string,
    clientId: string,
    requestedScopes: string[],
    userId: string,
  ): Promise<ConsentDetails> {
    const client = await this.loadClient(clientId);
    const [user, items] = await Promise.all([
      this.repositories.users.findById(userId),
      this.repositories.vault.listForUser(userId),
    ]);

    const dataScopes = requestedScopes.filter((scope) => scope !== 'openid');
    const suggestions = suggestSelections(client.purpose, client.allowedScopes, dataScopes, items);
    const required = new Set(client.requiredScopes);

    return {
      uid,
      prompt: 'consent',
      client: { id: client.id, name: client.name, purpose: client.purpose },
      settings: { confirmSensitive: user?.confirmSensitive ?? true },
      fields: suggestions.map((s) => ({
        scope: s.scope,
        kind: s.kind,
        required: required.has(s.scope),
        sensitive: s.sensitive,
        missing: s.missing,
        suggestedIds: s.suggestedIds,
        options: s.options.map(toOption),
      })),
    };
  }

  // Normalizes the decision into granted scopes + per-scope selections with
  // value snapshots. Required scopes cannot be excluded and must have data;
  // optional scopes without data are dropped silently.
  async applyDecision(
    userId: string,
    clientId: string,
    requestedScopes: string[],
    input: DecisionInput,
  ): Promise<AppliedDecision> {
    const client = await this.loadClient(clientId);
    const items = await this.repositories.vault.listForUser(userId);

    const allowed = new Set(client.allowedScopes);
    const dataScopes = requestedScopes.filter((scope) => scope !== 'openid' && allowed.has(scope));

    const excluded = new Set(input.excludedScopes ?? []);
    const excludedRequired = client.requiredScopes.filter(
      (scope) => dataScopes.includes(scope) && excluded.has(scope),
    );
    if (excludedRequired.length > 0) {
      throw new AppError(
        400,
        'INVALID_DECISION',
        `Required data cannot be excluded: ${excludedRequired.join(', ')}`,
      );
    }

    const kept = dataScopes.filter((scope) => !excluded.has(scope));
    const suggestions = new Map(
      suggestSelections(client.purpose, client.allowedScopes, kept, items).map((s) => [s.scope, s]),
    );

    const grantedScopes: string[] = [];
    const selections: ConsentSelection[] = [];
    const missing: string[] = [];

    for (const scope of kept) {
      const suggestion = suggestions.get(scope);
      if (!suggestion) continue;

      const requestedIds = input.selections?.[scope];
      let chosen: VaultItem[];
      if (requestedIds && requestedIds.length > 0) {
        chosen = suggestion.options.filter((option) => requestedIds.includes(option.id));
        if (chosen.length !== requestedIds.length) {
          throw new AppError(400, 'INVALID_DECISION', `Unknown value selected for ${scope}`);
        }
        if (suggestion.kind !== 'allergy' && chosen.length > 1) {
          throw new AppError(400, 'INVALID_DECISION', `Only one value can be shared for ${scope}`);
        }
      } else {
        chosen = suggestion.options.filter((option) =>
          suggestion.suggestedIds.includes(option.id),
        );
      }

      if (chosen.length === 0) {
        if (client.requiredScopes.includes(scope)) missing.push(scope);
        continue;
      }

      grantedScopes.push(scope);
      selections.push({
        scope,
        itemIds: chosen.map((item) => item.id),
        snapshot: chosen.map((item) => ({
          label: item.label,
          value: item.value,
          detail: item.detail,
        })),
      });
    }

    if (missing.length > 0) {
      throw new AppError(400, 'MISSING_FIELDS', 'Add the missing data to continue', {
        scopes: missing.join(' '),
      });
    }

    return {
      purpose: client.purpose,
      grantedScopes,
      rejectedScopes: dataScopes.filter((scope) => !grantedScopes.includes(scope)),
      selections,
    };
  }
}
