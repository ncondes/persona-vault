import { describe, expect, it } from "vitest";
import { NAV_ITEMS, pageTitle } from "./nav";
import { getStrings } from "./strings";

const t = getStrings("en");
const es = getStrings("es");

describe("NAV_ITEMS", () => {
  it("has a translated label for every entry, in both languages", () => {
    for (const item of NAV_ITEMS) {
      expect(t.nav[item.key]).toBeTruthy();
      expect(es.nav[item.key]).toBeTruthy();
    }
  });

  it("points every entry at an absolute path, with no duplicates", () => {
    const paths = NAV_ITEMS.map((item) => item.href);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path.startsWith("/")).toBe(true);
  });
});

describe("pageTitle", () => {
  it.each(NAV_ITEMS.map((item) => [item.href, item.key] as const))(
    "titles %s with its section name",
    (href, key) => {
      expect(pageTitle(href, t)).toBe(t.nav[key]);
    },
  );

  // Matched by prefix, so every page inside a section keeps the section's title
  // in the mobile header instead of going blank.
  it.each([
    ["/console/scopes", "console"],
    ["/console/new", "console"],
    ["/console/city-health-clinic-a3f91c", "console"],
    ["/vault?tab=health", "vault"],
  ] as const)("titles %s with %s", (path, key) => {
    expect(pageTitle(path, t)).toBe(t.nav[key]);
  });

  it.each(["/", "/login", "/authorize/abc123", "/onboarding"])(
    "falls back to the product name outside the sections, for %s",
    (path) => {
      expect(pageTitle(path, t)).toBe(t.appName);
    },
  );

  it("uses the Spanish label when the Spanish strings are passed", () => {
    expect(pageTitle("/connections", es)).toBe(es.nav.connections);
    expect(pageTitle("/connections", es)).not.toBe(t.nav.connections);
  });
});
