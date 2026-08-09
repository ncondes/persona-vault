import { describe, expect, it } from "vitest";
import { COMPOSED_KINDS, itemPayload, LABELED_KINDS, type ItemFormState } from "./item-payload";
import type { VaultKind } from "./types";

const state = (overrides: Partial<ItemFormState> = {}): ItemFormState => ({
  value: "",
  label: "",
  nameContext: "preferred",
  parts: {},
  ...overrides,
});

describe("composed kinds", () => {
  // The server builds the value from the parts, so sending one would either be
  // ignored or fight with what the server computes.
  it.each(COMPOSED_KINDS)("withholds the value for %s", (kind) => {
    expect(itemPayload(kind, state({ value: "typed by hand" })).value).toBeUndefined();
  });

  it("sends the two name parts and the chosen context", () => {
    const payload = itemPayload("name", {
      ...state({ nameContext: "legal" }),
      parts: { firstName: "Camila", lastName: "Rodríguez García" },
    });

    expect(payload.detail).toEqual({ firstName: "Camila", lastName: "Rodríguez García" });
    expect(payload.nameContext).toBe("legal");
  });

  it("sends the dial code with the number", () => {
    const payload = itemPayload("phone", {
      ...state(),
      parts: { countryCode: "+57", number: "300 111 2233" },
    });

    expect(payload.detail).toEqual({ countryCode: "+57", number: "300 111 2233" });
  });

  it("sends a full address", () => {
    const payload = itemPayload("address", {
      ...state(),
      parts: {
        line1: "Cra 7 # 45-10",
        line2: "Apt 402",
        line3: "Tower B",
        city: "Bogotá",
        postalCode: "110111",
        country: "CO",
      },
    });

    expect(payload.detail).toEqual({
      line1: "Cra 7 # 45-10",
      line2: "Apt 402",
      line3: "Tower B",
      city: "Bogotá",
      postalCode: "110111",
      country: "CO",
    });
  });

  // An empty string would be stored and then rendered as a blank line in the
  // address; undefined is simply absent.
  it("drops the optional address lines when they are blank", () => {
    const payload = itemPayload("address", {
      ...state(),
      parts: { line1: "Cra 7 # 45-10", line2: "", line3: "", city: "Bogotá", postalCode: "", country: "CO" },
    });

    expect(payload.detail).toEqual({
      line1: "Cra 7 # 45-10",
      line2: undefined,
      line3: undefined,
      city: "Bogotá",
      postalCode: undefined,
      country: "CO",
    });
  });
});

describe("documents", () => {
  it("sends the type, issue date and place alongside the number", () => {
    const payload = itemPayload("document", {
      ...state({ value: "1020304050" }),
      parts: { type: "PASSPORT", issueDate: "2015-04-02", issuePlace: "Bogotá" },
    });

    expect(payload.value).toBe("1020304050");
    expect(payload.detail).toEqual({
      type: "PASSPORT",
      issueDate: "2015-04-02",
      issuePlace: "Bogotá",
    });
  });

  // The select shows CC first; if the person never opens it the form still has
  // to send a type, because the server requires one.
  it("defaults the type to CC when the select was never touched", () => {
    const payload = itemPayload("document", {
      ...state({ value: "1020304050" }),
      parts: { issueDate: "2015-04-02", issuePlace: "Bogotá" },
    });

    expect(payload.detail).toMatchObject({ type: "CC" });
  });
});

describe("labels", () => {
  it.each(LABELED_KINDS)("keeps a label on %s", (kind) => {
    expect(itemPayload(kind, state({ value: "x", label: "Work" })).label).toBe("Work");
  });

  it.each(["name", "username", "birth_date", "blood_type", "eps", "allergy"] as VaultKind[])(
    "drops a label on %s, which cannot carry one",
    (kind) => {
      expect(itemPayload(kind, state({ value: "x", label: "Work" })).label).toBeNull();
    },
  );

  it("sends null rather than an empty or whitespace-only label", () => {
    expect(itemPayload("email", state({ value: "a@example.com", label: "" })).label).toBeNull();
    expect(itemPayload("email", state({ value: "a@example.com", label: "   " })).label).toBeNull();
  });

  it("trims a label the person padded", () => {
    expect(itemPayload("email", state({ value: "a@example.com", label: "  Work  " })).label).toBe(
      "Work",
    );
  });
});

describe("plain kinds", () => {
  it("trims the value", () => {
    expect(itemPayload("email", state({ value: "  camila@example.com  " })).value).toBe(
      "camila@example.com",
    );
  });

  it("sends no detail for a kind that has no parts", () => {
    expect(itemPayload("email", state({ value: "a@example.com" })).detail).toBeUndefined();
  });

  it("sends no name context for anything but a name", () => {
    expect(itemPayload("email", state({ value: "a@example.com" })).nameContext).toBeUndefined();
    expect(itemPayload("username", state({ value: "camir" })).nameContext).toBeUndefined();
  });
});
