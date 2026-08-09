import type { PreviewResult } from "@/lib/types";

export interface PayloadLine {
  text: string;
  note?: string;
  muted?: boolean;
}

// Renders the claims object as annotated JSON, one line at a time so each can
// carry its own note.
//
// Missing scopes are shown as `null` rather than omitted, because a developer
// needs to tell "you did not ask for this" apart from "this person has not
// filled it in" — the second is a prompt to handle absent data, the first is a
// bug in their scope list.
export function toPayloadLines(
  preview: PreviewResult,
  noData: string,
  alwaysPresent: string,
): PayloadLine[] {
  const lines: PayloadLine[] = [{ text: "{" }];
  const { sub, ...claims } = preview.claims as { sub?: unknown } & Record<string, unknown>;
  const keys = Object.keys(claims);
  const missing = preview.missing;

  if (sub !== undefined) {
    lines.push({
      text: `  "sub": ${JSON.stringify(sub)}${keys.length || missing.length ? "," : ""}`,
      note: alwaysPresent,
    });
  }

  keys.forEach((key, index) => {
    const last = index === keys.length - 1 && missing.length === 0;
    const body = JSON.stringify(claims[key], null, 2) ?? "null";
    const indented = body.split("\n").join("\n  ");
    lines.push({ text: `  ${JSON.stringify(key)}: ${indented}${last ? "" : ","}` });
  });

  missing.forEach((scope, index) => {
    lines.push({
      text: `  ${JSON.stringify(scope)}: null${index === missing.length - 1 ? "" : ","}`,
      note: noData,
      muted: true,
    });
  });

  lines.push({ text: "}" });
  return lines;
}
