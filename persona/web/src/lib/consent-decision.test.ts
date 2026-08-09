import { describe, expect, it } from "vitest";
import {
  buildDecision,
  isTrivial,
  missingRequired,
  needsConfirmation,
  partitionFields,
  sensitiveSharedCount,
} from "./consent-decision";
import type { ConsentPrompt, InteractionField } from "./types";

const field = (scope: string, overrides: Partial<InteractionField> = {}): InteractionField =>
  ({
    scope,
    kind: scope,
    required: false,
    sensitive: false,
    missing: false,
    suggestedIds: [`${scope}-1`],
    options: [{ id: `${scope}-1`, label: null, value: "v", detail: null, isDefault: true, nameContext: null }],
    ...overrides,
  }) as InteractionField;

const prompt = (fields: InteractionField[], confirmSensitive = true) =>
  ({ fields, settings: { confirmSensitive } }) as ConsentPrompt;

describe("partitionFields", () => {
  // Sensitive data sits below a divider so it cannot be approved by scrolling
  // past it without noticing.
  it("separates the sensitive fields from the rest, keeping order", () => {
    const fields = [
      field("name"),
      field("blood_type", { sensitive: true }),
      field("email"),
      field("document", { sensitive: true }),
    ];

    const { normal, sensitive } = partitionFields(fields);

    expect(normal.map((f) => f.scope)).toEqual(["name", "email"]);
    expect(sensitive.map((f) => f.scope)).toEqual(["blood_type", "document"]);
  });

  it("loses nothing", () => {
    const fields = [field("name"), field("document", { sensitive: true })];
    const { normal, sensitive } = partitionFields(fields);
    expect(normal.length + sensitive.length).toBe(fields.length);
  });
});

describe("missingRequired", () => {
  it("finds required data the person has not filled in", () => {
    const fields = [
      field("name"),
      field("eps", { required: true, missing: true }),
      field("phone", { missing: true }),
      field("email", { required: true }),
    ];

    expect(missingRequired(fields).map((f) => f.scope)).toEqual(["eps"]);
  });

  it("is empty when everything required is present", () => {
    expect(missingRequired([field("name", { required: true })])).toEqual([]);
  });
});

describe("isTrivial", () => {
  it("is true for a single ordinary field with one possible value", () => {
    expect(isTrivial([field("username")])).toBe(true);
  });

  it.each([
    ["two fields", [field("name"), field("email")]],
    ["a sensitive field", [field("document", { sensitive: true })]],
    ["a missing field", [field("phone", { missing: true })]],
    [
      "a field with a real choice",
      [
        field("email", {
          options: [
            { id: "a", label: null, value: "a@x.co", detail: null, isDefault: true, nameContext: null },
            { id: "b", label: "Work", value: "b@x.co", detail: null, isDefault: false, nameContext: null },
          ],
        } as Partial<InteractionField>),
      ],
    ],
  ])("is false with %s", (_label, fields) => {
    expect(isTrivial(fields as InteractionField[])).toBe(false);
  });
});

describe("sensitiveSharedCount", () => {
  const fields = [
    field("name"),
    field("document", { sensitive: true }),
    field("blood_type", { sensitive: true }),
    field("eps", { sensitive: true, missing: true }),
  ];

  it("counts only the sensitive fields that will actually be released", () => {
    // eps is sensitive but has no data, so nothing is shared for it.
    expect(sensitiveSharedCount(fields, new Set())).toBe(2);
  });

  it("stops counting a field the person switched off", () => {
    expect(sensitiveSharedCount(fields, new Set(["document"]))).toBe(1);
    expect(sensitiveSharedCount(fields, new Set(["document", "blood_type"]))).toBe(0);
  });

  it("ignores ordinary fields entirely", () => {
    expect(sensitiveSharedCount([field("name"), field("email")], new Set())).toBe(0);
  });
});

describe("needsConfirmation", () => {
  const sensitive = [field("name"), field("document", { sensitive: true })];

  it("asks again before releasing sensitive data", () => {
    expect(needsConfirmation(prompt(sensitive), new Set())).toBe(true);
  });

  it("does not ask when the person turned that setting off", () => {
    expect(needsConfirmation(prompt(sensitive, false), new Set())).toBe(false);
  });

  it("does not ask when nothing sensitive is being shared", () => {
    expect(needsConfirmation(prompt([field("name")]), new Set())).toBe(false);
    expect(needsConfirmation(prompt(sensitive), new Set(["document"]))).toBe(false);
  });
});

describe("buildDecision", () => {
  const fields = [field("name"), field("email"), field("document", { sensitive: true })];
  const selections = { name: ["name-1"], email: ["email-1"], document: ["document-1"] };

  it("sends what the person chose for each field they kept", () => {
    expect(buildDecision(fields, selections, new Set())).toEqual({
      selections: { name: ["name-1"], email: ["email-1"], document: ["document-1"] },
      excludedScopes: [],
    });
  });

  // "I decline this" and "I have nothing to give" mean different things to the
  // server, so an excluded scope is named rather than merely left out.
  it("names an excluded scope and leaves it out of the selections", () => {
    const decision = buildDecision(fields, selections, new Set(["document"]));

    expect(decision.excludedScopes).toEqual(["document"]);
    expect(decision.selections).not.toHaveProperty("document");
  });

  it("leaves out a field with nothing selected", () => {
    const decision = buildDecision(fields, { ...selections, email: [] }, new Set());

    expect(decision.selections).not.toHaveProperty("email");
    expect(decision.excludedScopes).toEqual([]);
  });

  it("leaves out a field with no entry at all", () => {
    const decision = buildDecision(fields, { name: ["name-1"] }, new Set());
    expect(Object.keys(decision.selections)).toEqual(["name"]);
  });

  // An empty decision is how the "share the defaults" path works: the server
  // falls back to the context-aware suggestion for every requested scope.
  it("sends an empty decision when the person changed nothing and chose nothing", () => {
    expect(buildDecision(fields, {}, new Set())).toEqual({ selections: {}, excludedScopes: [] });
  });
});
