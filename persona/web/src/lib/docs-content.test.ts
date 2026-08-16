import { describe, expect, it } from "vitest";
import { getDocsContent } from "./docs-content";

// The Spanish table is annotated `: DocsContent`, so a missing key is already a
// compile error. These tests catch what the type system cannot see: a key left
// in English, or the two tables drifting out of shape (e.g. a body paragraph
// added to one locale and not the other, which shows up as a different set of
// array indices).
const en = getDocsContent("en");
const es = getDocsContent("es");

type Node = Record<string, unknown>;

function paths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Node).flatMap(([key, child]) =>
    paths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function at(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node as Node)?.[key], root);
}

describe("getDocsContent", () => {
  it("returns Spanish for es and English otherwise", () => {
    expect(getDocsContent("es")).toBe(es);
    expect(getDocsContent("en")).toBe(en);
    for (const locale of [undefined, "", "fr", "ES", "en-GB"]) {
      expect(getDocsContent(locale as never)).toBe(en);
    }
  });
});

describe("English and Spanish stay in step", () => {
  it("have exactly the same set of keys", () => {
    expect(paths(es).sort()).toEqual(paths(en).sort());
  });

  it("has no leftover English in the Spanish table", () => {
    // Terms that are legitimately identical in both languages: the endpoint and
    // code labels, the OAuth vocabulary developers know by its English form, and
    // the .env filename.
    const identical = [
      "authorize.label",
      "callback.label",
      "userinfo.label",
      "register.envLabel",
      "scopes.variants.legal",
    ];
    const shared = paths(en).filter((path) => {
      if (identical.includes(path)) return false;
      const a = at(en, path);
      const b = at(es, path);
      return typeof a === "string" && a === b && a.length > 12;
    });

    expect(shared).toEqual([]);
  });
});
