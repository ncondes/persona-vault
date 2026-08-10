import { ApiError } from "@/lib/api";
import type { Strings } from "@/lib/strings";

// Zod reports a bad list item at `redirectUris.0`, but the form asks for
// `redirectUris`. Keeping the root alongside the full path lets a field find its
// own error without every caller knowing how the server spells the path.
function rootOf(path: string): string {
  return path.split(".")[0];
}

// Translates a validation error's `fields` map. Values the tables do not know
// are dropped rather than shown: `MISSING_FIELDS` puts a scope list in there,
// and a scope list is not a sentence.
export function fieldMessages(t: Strings, fields?: Record<string, string>): Record<string, string> {
  const messages: Record<string, string> = {};

  for (const [path, code] of Object.entries(fields ?? {})) {
    const message = t.errors.fields[code];
    if (!message) continue;
    messages[path] = message;
    messages[rootOf(path)] ??= message;
  }

  return messages;
}

// One sentence a person can read, out of whatever a request rejected with.
//
// The specific problem first — a validation error's field code says more than
// "some details need fixing" — then the error code, then an apology. The
// server's own `message` is never one of the options: it is English, written for
// a developer, and would reach a Spanish reader untranslated.
export function errorMessage(t: Strings, err: unknown): string {
  if (!(err instanceof ApiError)) return t.common.somethingWrong;

  return (
    Object.values(fieldMessages(t, err.fields))[0] ??
    t.errors.codes[err.code] ??
    t.common.somethingWrong
  );
}
