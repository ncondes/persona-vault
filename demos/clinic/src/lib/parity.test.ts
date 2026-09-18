import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The three demos duplicate their OAuth plumbing on purpose: each is meant to be
// a complete example a reader can lift whole, and three unrelated companies
// would not share a library. The cost of that decision is drift — a fix made in
// one copy and forgotten in the other two.
//
// Only the clinic's copy is tested. These checks are what make that enough: they
// fail if the other two stop matching it.
const DEMOS = join(process.cwd(), "..");
const OTHERS = ["forum", "store"];

const read = (demo: string, path: string) => readFileSync(join(DEMOS, demo, path), "utf8");

// Everything from the first function onward. What comes before it is the app's
// own configuration — its client id, port, cookie names and scope list — which
// is supposed to differ.
function behaviour(source: string): string {
  const start = source.indexOf("export const redirectUri");
  expect(start).toBeGreaterThan(-1);

  return source
    .slice(start)
    .replace(/^\s*\/\/.*$/gm, "") // comments are free to differ in wording
    .replace(/\s+/g, " ")
    .trim();
}

describe("the three demos have not drifted apart", () => {
  it.each(OTHERS)("%s implements the same OAuth plumbing as the clinic", (demo) => {
    const mine = behaviour(read("clinic", "src/lib/persona.ts"));
    const theirs = behaviour(read(demo, "src/lib/persona.ts"));

    expect(theirs).toBe(mine);
  });

  it.each(
    OTHERS.flatMap((demo) =>
      ["connect", "callback", "disconnect", "access-ended"].map((route) => [demo, route] as const),
    ),
  )("%s's %s route is identical to the clinic's", (demo, route) => {
    const path = `src/app/${route}/route.ts`;

    expect(read(demo, path)).toBe(read("clinic", path));
  });

  // The parity checks above are only worth anything if the shared code really is
  // the security-critical part. Assert that it is.
  it("covers the functions that carry PKCE and the state check", () => {
    const shared = behaviour(read("clinic", "src/lib/persona.ts"));

    for (const symbol of [
      "challengeFor",
      "newVerifier",
      "newState",
      "sameState",
      "authorizeUrl",
      "exchangeCode",
      "fetchClaims",
    ]) {
      expect(shared).toContain(symbol);
    }
  });
});

describe("each demo keeps its own identity", () => {
  it.each([
    ["clinic", "4411"],
    ["forum", "4412"],
    ["store", "4413"],
  ])("%s runs on its own port and cookies", (demo, port) => {
    const source = read(demo, "src/lib/persona.ts");

    expect(source).toContain(`http://localhost:${port}`);
    expect(source).toContain(`${demo}_session`);
    expect(source).toContain(`${demo}_oauth_state`);
    expect(source).toContain(`${demo}_oauth_verifier`);
  });

  // The contrast between these three is the project's central demonstration:
  // one person, one vault, three very different payloads.
  it.each([
    ["clinic", ["name", "document", "blood_type", "allergies", "address"], ["username"]],
    ["forum", ["name", "username"], ["email", "address", "blood_type"]],
    ["store", ["username", "email", "address"], ["blood_type", "allergies", "document"]],
  ])("%s asks for what it needs and nothing more", (demo, wanted, unwanted) => {
    const scope = /export const SCOPE\s*=\s*([\s\S]*?);/.exec(read(demo, "src/lib/persona.ts"))?.[1];
    const scopes = (scope ?? "").replace(/["\s]+/g, " ").trim().split(" ");

    expect(scopes).toContain("openid");
    for (const s of wanted) expect(scopes).toContain(s);
    for (const s of unwanted) expect(scopes).not.toContain(s);
  });
});
