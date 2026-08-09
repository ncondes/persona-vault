import { describe, expect, it } from "vitest";
import { KIND_SCOPE, SECTIONS } from "./sections";
import type { VaultKind } from "./types";

// Every kind the vault can store, taken from the scope map rather than
// re-listed, so a new kind shows up here automatically.
const ALL_KINDS = Object.keys(KIND_SCOPE) as VaultKind[];

describe("vault sections", () => {
  const placed = SECTIONS.flatMap((section) => section.kinds);

  it("puts each kind in at most one tab", () => {
    expect(new Set(placed).size).toBe(placed.length);
  });

  // A kind with no tab is unreachable in the UI. `avatar` is the deliberate
  // exception: it can be stored but never shared, so it has no vault tab either.
  it("gives every kind a tab, except avatar", () => {
    const homeless = ALL_KINDS.filter((kind) => !placed.includes(kind));
    expect(homeless).toEqual(["avatar"]);
  });

  it("has no empty tab", () => {
    for (const section of SECTIONS) {
      expect(section.kinds.length).toBeGreaterThan(0);
    }
  });

  it("keeps the health tab to the sensitive kinds", () => {
    const health = SECTIONS.find((section) => section.id === "health");
    expect(health?.kinds).toEqual(["blood_type", "eps", "allergy"]);
  });
});

describe("KIND_SCOPE", () => {
  it("names a scope for every kind", () => {
    for (const kind of ALL_KINDS) {
      expect(KIND_SCOPE[kind]).toBeTruthy();
    }
  });

  // They match everywhere but one: a person stores allergies one at a time, and
  // the scope releases the whole list.
  it("matches the kind name except for allergies", () => {
    const different = ALL_KINDS.filter((kind) => KIND_SCOPE[kind] !== kind);
    expect(different).toEqual(["allergy"]);
    expect(KIND_SCOPE.allergy).toBe("allergies");
  });
});
