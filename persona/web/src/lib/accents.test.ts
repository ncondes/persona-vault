import { describe, expect, it } from "vitest";
import { ACCENTS, ACCENT_NAMES, accentHex, initialsOfApp } from "./accents";

// The monogram and its colour are the only thing identifying an app on Persona's
// own consent screen — the surface where someone decides whether to trust it.
describe("accentHex", () => {
  it("returns the hex for every name in the palette", () => {
    for (const name of ACCENT_NAMES) {
      expect(accentHex(name)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  // A stored accent could name a colour that has since been removed; falling
  // back keeps the monogram readable instead of rendering it transparent.
  it.each(["", "chartreuse", "TEAL", "#ff0000"])("falls back to teal for %o", (unknown) => {
    expect(accentHex(unknown)).toBe(ACCENTS.teal);
  });

  it("offers exactly the six curated colours", () => {
    expect(ACCENT_NAMES).toEqual(["teal", "blue", "violet", "rust", "green", "slate"]);
  });
});

describe("initialsOfApp", () => {
  it.each([
    // Two or more words: the first letter of each of the first two.
    ["City Health Clinic", "CH"],
    ["Hobbyist Forum", "HF"],
    ["  Tiger   Store  ", "TS"],
    ["x y", "XY"],
    // One word: its first two letters instead.
    ["forum", "FO"],
    // One letter is all there is.
    ["X", "X"],
  ])("turns %o into %o", (name, expected) => {
    expect(initialsOfApp(name)).toBe(expected);
  });

  it.each(["", "   ", "\t\n"])("shows a placeholder rather than nothing for %o", (blank) => {
    expect(initialsOfApp(blank)).toBe("··");
  });

  it("never returns more than two characters", () => {
    for (const name of ["A", "Ab", "A B C D", "Extraordinarily Long Application Name"]) {
      expect(initialsOfApp(name).length).toBeLessThanOrEqual(2);
    }
  });
});
