import type { ConsentPrompt, InteractionField } from "@/lib/types";

export interface ConsentDecision {
  selections: Record<string, string[]>;
  excludedScopes: string[];
}

// Splits the fields the way the screen shows them: ordinary data first, then
// sensitive data below a divider, so nothing sensitive is approved by scrolling
// past it.
export function partitionFields(fields: InteractionField[]) {
  return {
    normal: fields.filter((field) => !field.sensitive),
    sensitive: fields.filter((field) => field.sensitive),
  };
}

// Required data the person does not have yet. The approve button stays disabled
// until every one of these is filled in from the consent screen itself.
export function missingRequired(fields: InteractionField[]): InteractionField[] {
  return fields.filter((field) => field.missing && field.required);
}

// One ordinary field with one possible value and nothing to decide. Showing a
// verification badge and a choice UI over that would be theatre, so the screen
// says so plainly instead.
export function isTrivial(fields: InteractionField[]): boolean {
  const [only] = fields;
  return fields.length === 1 && !only.sensitive && !only.missing && only.options.length === 1;
}

// How many sensitive fields would actually be released. Drives the extra
// confirmation, so it counts what is really being shared — not what was asked
// for, and not fields the vault has no data for.
export function sensitiveSharedCount(
  fields: InteractionField[],
  excluded: ReadonlySet<string>,
): number {
  return partitionFields(fields).sensitive.filter(
    (field) => !excluded.has(field.scope) && !field.missing,
  ).length;
}

export function needsConfirmation(
  prompt: Pick<ConsentPrompt, "fields" | "settings">,
  excluded: ReadonlySet<string>,
): boolean {
  return prompt.settings.confirmSensitive && sensitiveSharedCount(prompt.fields, excluded) > 0;
}

// The body posted to /decision. An excluded scope is named in `excludedScopes`
// rather than merely left out of `selections`, because the two mean different
// things to the server: "I decline this" versus "I have nothing to give".
export function buildDecision(
  fields: InteractionField[],
  selections: Record<string, string[]>,
  excluded: ReadonlySet<string>,
): ConsentDecision {
  return {
    selections: Object.fromEntries(
      fields
        .filter((field) => !excluded.has(field.scope) && (selections[field.scope]?.length ?? 0) > 0)
        .map((field) => [field.scope, selections[field.scope]]),
    ),
    excludedScopes: [...excluded],
  };
}
