import type { AppView } from "@/lib/types";

// What an app asks for, as the console's scope picker holds it. Absent means the
// app does not ask for the scope at all.
export type ScopeLevel = "optional" | "required";
export type ScopeSelection = Record<string, ScopeLevel>;

export function selectionFrom(allowed: string[], required: string[]): ScopeSelection {
  const selection: ScopeSelection = {};
  for (const scope of allowed) {
    selection[scope] = required.includes(scope) ? "required" : "optional";
  }
  return selection;
}

export function selectionToScopes(selection: ScopeSelection) {
  const allowedScopes = Object.keys(selection);
  return {
    allowedScopes,
    requiredScopes: allowedScopes.filter((scope) => selection[scope] === "required"),
  };
}

// Whether the picker holds unsaved changes, and whether those changes take
// something away. Narrowing revokes standing consent server-side, so the console
// asks before saving one.
export function diffScopes(app: AppView, next: ReturnType<typeof selectionToScopes>) {
  const same = (a: string[], b: string[]) =>
    a.slice().sort().join(" ") === b.slice().sort().join(" ");

  return {
    dirty:
      !same(next.allowedScopes, app.allowedScopes) ||
      !same(next.requiredScopes, app.requiredScopes),
    removes: app.allowedScopes.some((scope) => !next.allowedScopes.includes(scope)),
  };
}
