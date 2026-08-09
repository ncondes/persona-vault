// An app's accent shows as its monogram on Persona's own consent screen, so the
// palette is curated rather than free: every colour here clears 4.5:1 against
// white text, and none of them can be mistaken for Persona's own chrome.
export const ACCENTS = {
  teal: "#1f6f80",
  blue: "#2f5fa8",
  violet: "#6d5bd0",
  rust: "#b4552a",
  green: "#2f7a4f",
  slate: "#3f3f46",
} as const;

export type Accent = keyof typeof ACCENTS;

export const ACCENT_NAMES = Object.keys(ACCENTS) as Accent[];

export function accentHex(accent: string): string {
  return ACCENTS[accent as Accent] ?? ACCENTS.teal;
}

export function initialsOfApp(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "··";
  return (words[0][0] + (words[1]?.[0] ?? words[0][1] ?? "")).toUpperCase();
}
