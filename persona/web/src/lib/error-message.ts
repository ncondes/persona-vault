import { ApiError } from "@/lib/api";
import type { Strings } from "@/lib/strings";

// One sentence a person can read, out of whatever a request rejected with.
//
// The server's own message is only shown for 4xx, where it is written for
// people. A 5xx, or a response with no JSON body at all — which `request()`
// labels UNKNOWN / "Request failed" — gets the generic apology instead, so an
// untranslated English string never reaches a Spanish reader.
export function errorMessage(t: Strings, err: unknown): string {
  if (!(err instanceof ApiError)) return t.common.somethingWrong;

  const translated = t.auth.errors[err.code] ?? t.vault.errors[err.code];
  if (translated) return translated;

  const field = Object.values(err.fields ?? {})[0];
  if (field) return field;

  if (err.status >= 500 || err.code === "UNKNOWN") return t.common.somethingWrong;
  return err.message;
}
