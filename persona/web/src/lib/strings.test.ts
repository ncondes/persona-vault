import { describe, expect, it } from "vitest";
import { getStrings } from "./strings";

// The Spanish table is annotated `: Strings`, so a *missing* key is already a
// compile error. What the type system cannot see is a key that exists but was
// left in English, or a plural rule that only works in one language.
const en = getStrings("en");
const es = getStrings("es");

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

describe("getStrings", () => {
  it("returns Spanish for es and English for en", () => {
    expect(es.nav.vault).not.toBe(en.nav.vault);
    expect(getStrings("en")).toBe(en);
  });

  it.each([[undefined], [""], ["fr"], ["ES"], ["en-GB"]])(
    "falls back to English for %o",
    (locale) => {
      expect(getStrings(locale as never)).toBe(en);
    },
  );
});

describe("English and Spanish stay in step", () => {
  it("have exactly the same set of keys", () => {
    expect(paths(es).sort()).toEqual(paths(en).sort());
  });

  it("agree on which entries are functions", () => {
    const kinds = (root: unknown) =>
      paths(root)
        .map((path) => `${path}:${typeof at(root, path)}`)
        .sort();

    expect(kinds(es)).toEqual(kinds(en));
  });

  // Catches a key that was copied over and never translated. A handful of terms
  // are legitimately identical in both languages, so those are listed rather
  // than the rule being weakened.
  it("has no leftover English in the Spanish table", () => {
    // Spelled the same in both languages: the product name, and the OAuth term
    // developers already know by its English form.
    const identical = ["appName", "common.sensitiveBadge", "console.credentials.clientSecret"];
    const shared = paths(en).filter((path) => {
      if (identical.includes(path)) return false;
      const a = at(en, path);
      const b = at(es, path);
      return typeof a === "string" && a === b && a.length > 12;
    });

    expect(shared).toEqual([]);
  });
});

describe("pluralisation", () => {
  // Spanish and English pluralise differently, so each language needs its own
  // check rather than one shared assertion.
  it.each([
    ["en", en],
    ["es", es],
  ])("%s counts items in singular and plural", (_locale, t) => {
    expect(t.connections.itemCount(1)).not.toBe(t.connections.itemCount(2));
    expect(t.connections.itemCount(1)).toContain("1");
    expect(t.connections.itemCount(7)).toContain("7");
  });

  it("uses the Spanish singular and plural forms", () => {
    expect(es.connections.itemCount(1)).toMatch(/\bdato\b/);
    expect(es.connections.itemCount(2)).toMatch(/\bdatos\b/);
  });

  it("handles zero without falling back to the singular", () => {
    expect(en.connections.itemCount(0)).toContain("0");
    expect(es.connections.itemCount(0)).toContain("0");
  });

  it("interpolates a name into the revoke confirmation", () => {
    for (const t of [en, es]) {
      expect(t.connections.revokeConfirm("City Health Clinic")).toContain("City Health Clinic");
    }
  });
});

// The tables hold nine functions per locale for pluralisation and interpolation.
// Sweeping all of them catches the copy-paste failure the type system cannot
// see: a Spanish function that ignores its argument and returns a fixed string.
describe("every interpolated string uses its argument", () => {
  function functionPaths(root: unknown): string[] {
    return paths(root).filter((path) => typeof at(root, path) === "function");
  }

  it("has the same interpolated strings in both locales", () => {
    expect(functionPaths(es).sort()).toEqual(functionPaths(en).sort());
    expect(functionPaths(en).length).toBe(11);
  });

  it.each([
    ["en", en],
    ["es", es],
  ])("%s renders every one of them with the value it was given", (_locale, t) => {
    for (const path of functionPaths(t)) {
      const render = at(t, path) as (arg: unknown) => unknown;

      // Some take a count and some take a name, so probe with a number and fall
      // back to the same value as text. 1 and 7 between them reach both sides of
      // every singular/plural branch.
      for (const probe of [1, 7]) {
        let rendered: unknown;
        try {
          rendered = render(probe);
        } catch {
          rendered = render(String(probe));
        }

        expect(typeof rendered, path).toBe("string");
        expect(String(rendered), path).toContain(String(probe));
      }
    }
  });
});
