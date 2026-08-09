import { describe, expect, it } from "vitest";
import { toPayloadLines } from "./payload-lines";
import type { PreviewResult } from "./types";

const NO_DATA = "no data yet";
const ALWAYS = "always present";

const lines = (preview: PreviewResult) => toPayloadLines(preview, NO_DATA, ALWAYS);
const text = (preview: PreviewResult) => lines(preview).map((line) => line.text).join("\n");

// The console's live payload panel. It has to read as JSON a developer can trust
// — which means the commas have to be right — while still marking the fields the
// person has not filled in.
describe("toPayloadLines", () => {
  it("renders a claims object as valid JSON", () => {
    const rendered = text({
      claims: { sub: "user-1", name: "Camila R.", email: "camila@example.com" },
      missing: [],
    });

    expect(() => JSON.parse(rendered)).not.toThrow();
    expect(JSON.parse(rendered)).toEqual({
      sub: "user-1",
      name: "Camila R.",
      email: "camila@example.com",
    });
  });

  it("puts sub first and marks it as always present", () => {
    const [, subLine] = lines({ claims: { name: "Camila R.", sub: "user-1" }, missing: [] });

    expect(subLine.text).toContain('"sub"');
    expect(subLine.note).toBe(ALWAYS);
  });

  // "You did not ask for this" and "this person has not filled it in" are
  // different problems, so a missing scope is shown as null rather than omitted.
  it("shows a missing scope as null, greyed out and annotated", () => {
    const rendered = lines({ claims: { sub: "user-1" }, missing: ["blood_type"] });
    const missing = rendered.find((line) => line.text.includes("blood_type"));

    expect(missing?.text.trim()).toBe('"blood_type": null');
    expect(missing?.note).toBe(NO_DATA);
    expect(missing?.muted).toBe(true);
  });

  it("still parses as JSON once the missing scopes are added", () => {
    const rendered = text({
      claims: { sub: "user-1", name: "Camila R." },
      missing: ["blood_type", "eps"],
    });

    expect(JSON.parse(rendered)).toEqual({
      sub: "user-1",
      name: "Camila R.",
      blood_type: null,
      eps: null,
    });
  });

  describe("commas", () => {
    it("omits the trailing comma on the last claim", () => {
      const rendered = lines({ claims: { sub: "user-1", name: "Camila R." }, missing: [] });
      expect(rendered.at(-2)?.text.endsWith(",")).toBe(false);
    });

    it("keeps the comma after sub when something follows it", () => {
      const [, subLine] = lines({ claims: { sub: "user-1", name: "x" }, missing: [] });
      expect(subLine.text.endsWith(",")).toBe(true);
    });

    it("keeps the comma after sub when only a missing scope follows", () => {
      const [, subLine] = lines({ claims: { sub: "user-1" }, missing: ["eps"] });
      expect(subLine.text.endsWith(",")).toBe(true);
    });

    it("drops the comma after sub when it is the only line", () => {
      const [, subLine] = lines({ claims: { sub: "user-1" }, missing: [] });
      expect(subLine.text.endsWith(",")).toBe(false);
    });

    it("keeps the comma after the last claim when a missing scope follows", () => {
      const rendered = text({ claims: { sub: "u", name: "Camila" }, missing: ["eps"] });
      expect(() => JSON.parse(rendered)).not.toThrow();
    });
  });

  it("indents a nested object so it lines up inside the payload", () => {
    const rendered = text({
      claims: {
        sub: "user-1",
        document: { type: "CC", number: "1020304050" },
      },
      missing: [],
    });

    expect(JSON.parse(rendered).document).toEqual({ type: "CC", number: "1020304050" });
    expect(rendered).toContain('  "document": {');
    expect(rendered).toContain('    "type": "CC"');
  });

  it("renders an array claim on its own lines", () => {
    const rendered = text({
      claims: { sub: "user-1", allergies: ["Penicillin", "Peanuts"] },
      missing: [],
    });

    expect(JSON.parse(rendered).allergies).toEqual(["Penicillin", "Peanuts"]);
  });

  it("renders an empty payload as an empty object", () => {
    expect(text({ claims: {}, missing: [] })).toBe("{\n}");
  });

  it("renders a payload with nothing but missing scopes", () => {
    expect(JSON.parse(text({ claims: {}, missing: ["eps"] }))).toEqual({ eps: null });
  });
});
