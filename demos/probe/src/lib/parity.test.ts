import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ATTACKS, attackById } from "./attacks";
import { SCOPE } from "./persona";

const DEMOS = join(process.cwd(), "..");
const read = (demo: string, path: string) => readFileSync(join(DEMOS, demo, path), "utf8");

// Same extraction the clinic's parity test uses: everything from the first
// function onward, with the app's own configuration left out.
function behaviour(source: string): string {
  const start = source.indexOf("export const redirectUri");
  expect(start).toBeGreaterThan(-1);

  return source
    .slice(start)
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

// The claim this file exists to defend: Probe is hostile, but it is not a
// broken client. If its OAuth plumbing drifted from the honest demos, every
// refusal on the console could be explained away as Probe simply getting the
// protocol wrong, and the whole exercise would prove nothing.
describe("Probe is a correct client that behaves badly, not a broken one", () => {
  it("runs the same OAuth plumbing as the honest demos", () => {
    expect(behaviour(read("probe", "src/lib/persona.ts"))).toBe(
      behaviour(read("clinic", "src/lib/persona.ts")),
    );
  });

  it("starts the flow exactly as the honest demos do", () => {
    expect(read("probe", "src/app/connect/route.ts")).toBe(
      read("clinic", "src/app/connect/route.ts"),
    );
  });

  // The one honest deviation, asserted rather than left implicit: Probe keeps
  // the code it spent so the replay check has a real one to offer back.
  it("differs from the honest callback only by keeping the spent code", () => {
    const mine = read("probe", "src/app/callback/route.ts");
    const theirs = read("clinic", "src/app/callback/route.ts");

    expect(mine).toContain("SPENT_CODE_COOKIE");
    expect(theirs).not.toContain("SPENT_CODE_COOKIE");

    const stripped = mine
      .replace(/import \{ SPENT_CODE_COOKIE \}[^\n]*\n/, "")
      .replace(/\n *\/\/ The one line[\s\S]*?\n *\}\);\n/, "\n");

    // What is left must still be the clinic's callback, apart from where each
    // app sends the person afterwards.
    expect(behaviourOf(stripped)).toBe(behaviourOf(theirs.replace("/home", "/console")));
  });
});

function behaviourOf(source: string): string {
  return source
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("Probe keeps its own identity", () => {
  it("runs on its own port and cookies", () => {
    const source = read("probe", "src/lib/persona.ts");

    expect(source).toContain("http://localhost:4414");
    expect(source).toContain("probe_session");
    expect(source).toContain("probe_oauth_state");
    expect(source).toContain("probe_oauth_verifier");
  });

  // Registered modestly on purpose. Everything the console then reaches for is
  // outside this list, which is what makes each refusal meaningful.
  it("registers for nothing more than a name and a handle", () => {
    const scopes = SCOPE.split(" ");

    expect(scopes).toEqual(["openid", "name", "username"]);
    for (const greedy of ["document", "blood_type", "allergies", "address", "email"]) {
      expect(scopes).not.toContain(greedy);
    }
  });
});

describe("the attack list", () => {
  it("holds ten distinct checks", () => {
    expect(ATTACKS).toHaveLength(10);
    expect(new Set(ATTACKS.map((attack) => attack.id)).size).toBe(10);
  });

  it("describes what each one sends and what should come back", () => {
    for (const attack of ATTACKS) {
      expect(attack.title.length).toBeGreaterThan(0);
      expect(attack.threat).toContain("—");
      expect(attack.method.length).toBeGreaterThan(20);
      expect(attack.expected.length).toBeGreaterThan(20);
    }
  });

  it("keeps only the code replay behind its own button", () => {
    expect(ATTACKS.filter((attack) => attack.destructive).map((a) => a.id)).toEqual(["code-replay"]);
  });

  it("finds an attack by id, and nothing by a made-up one", () => {
    expect(attackById("consent-bypass")?.title).toBe("Read what the person declined");
    expect(attackById("not-an-attack")).toBeUndefined();
  });
});
