import type { ItemDetail, NameContext, VaultKind } from "@/lib/types";

// Kinds that can carry a user-chosen label ("Work", "Home"). A label on anything
// else would be dropped by the API, so the form does not offer one.
export const LABELED_KINDS: VaultKind[] = ["email", "phone", "address", "document"];

// Kinds whose value the server composes from the parts, so the form must not
// send a `value` of its own.
export const COMPOSED_KINDS: VaultKind[] = ["name", "phone", "address"];

export const NAME_CONTEXTS: NameContext[] = ["legal", "preferred", "professional", "public"];

export interface ItemFormState {
  value: string;
  label: string;
  nameContext: NameContext;
  parts: Record<string, string>;
}

export interface ItemPayload {
  value: string | undefined;
  label: string | null;
  nameContext: NameContext | undefined;
  detail: ItemDetail | undefined;
}

// Turns the form's flat state into the request body for one vault item.
//
// Kept out of the submit handler so the per-kind shaping can be checked directly:
// which parts become `detail`, when `value` is withheld because the server
// composes it, and which optional address lines are dropped rather than sent
// empty (an empty string would be stored and then rendered as a blank line).
export function itemPayload(kind: VaultKind, state: ItemFormState): ItemPayload {
  const part = (key: string) => state.parts[key] ?? "";

  let detail: ItemDetail | undefined;
  if (kind === "name") detail = { firstName: part("firstName"), lastName: part("lastName") };
  if (kind === "phone") detail = { countryCode: part("countryCode"), number: part("number") };
  if (kind === "address") {
    detail = {
      line1: part("line1"),
      line2: part("line2") || undefined,
      line3: part("line3") || undefined,
      city: part("city"),
      postalCode: part("postalCode") || undefined,
      country: part("country"),
    };
  }
  if (kind === "document") {
    detail = {
      type: part("type") || "CC",
      issueDate: part("issueDate"),
      issuePlace: part("issuePlace"),
    };
  }

  return {
    value: COMPOSED_KINDS.includes(kind) ? undefined : state.value.trim(),
    label: LABELED_KINDS.includes(kind) && state.label.trim() ? state.label.trim() : null,
    nameContext: kind === "name" ? state.nameContext : undefined,
    detail,
  };
}
