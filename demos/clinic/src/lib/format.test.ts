import { describe, expect, it } from "vitest";
import { formatClaim, initialsOf } from "./format";

// What the intake form prints for each field it received. Returning null is
// meaningful: it means the person did not share this, and the form draws a blank
// rule instead of the word "undefined".
describe("formatClaim", () => {
  describe("nothing shared", () => {
    it.each([
      ["name", undefined],
      ["name", null],
      ["allergies", []],
      ["document", { type: "CC" }],
      ["address", {}],
    ])("returns null for %s = %o", (scope, value) => {
      expect(formatClaim(scope, value)).toBeNull();
    });
  });

  describe("catalog codes", () => {
    it.each([
      ["O_POS", "O+"],
      ["AB_NEG", "AB−"],
    ])("prints blood type %s as %s", (code, label) => {
      expect(formatClaim("blood_type", code)).toBe(label);
    });

    it.each([
      ["SANITAS", "Sanitas"],
      ["NUEVA_EPS", "Nueva EPS"],
    ])("prints EPS %s as %s", (code, label) => {
      expect(formatClaim("eps", code)).toBe(label);
    });

    // A code Persona adds later must still show, not vanish.
    it.each([
      ["blood_type", "XX_POS"],
      ["eps", "A_NEW_INSURER"],
    ])("falls back to the raw %s code when it is unknown", (scope, code) => {
      expect(formatClaim(scope, code)).toBe(code);
    });
  });

  describe("allergies", () => {
    it("joins the list", () => {
      expect(formatClaim("allergies", ["Penicillin", "Peanuts"])).toBe("Penicillin, Peanuts");
    });

    it("prints a single allergy on its own", () => {
      expect(formatClaim("allergies", ["Latex"])).toBe("Latex");
    });
  });

  describe("documents", () => {
    it("prints the type and the number", () => {
      expect(formatClaim("document", { type: "CC", number: "1020304050" })).toBe(
        "Cédula de ciudadanía · 1020304050",
      );
    });

    it("prints the number alone when the type is missing", () => {
      expect(formatClaim("document", { number: "1020304050" })).toBe("1020304050");
    });

    it("keeps an unknown document type as its code", () => {
      expect(formatClaim("document", { type: "XYZ", number: "1" })).toBe("XYZ · 1");
    });
  });

  describe("addresses", () => {
    it("prints the formatted line", () => {
      expect(
        formatClaim("address", { formatted: "Cra 7 # 45-10, Bogotá", city: "Bogotá" }),
      ).toBe("Cra 7 # 45-10, Bogotá");
    });
  });

  describe("birth dates", () => {
    it("renders an ISO date the way a person reads it", () => {
      expect(formatClaim("birth_date", "1998-04-02")).toBe("2 April 1998");
    });

    // Better to show the raw value than to print "Invalid Date".
    it("falls back to the raw value when it will not parse", () => {
      expect(formatClaim("birth_date", "not-a-date")).toBe("not-a-date");
    });
  });

  describe("everything else", () => {
    it("prints a plain string as-is", () => {
      expect(formatClaim("email", "camila@example.com")).toBe("camila@example.com");
    });

    it("falls back to JSON for a shape it does not know", () => {
      expect(formatClaim("mystery", { a: 1 })).toBe('{"a":1}');
      expect(formatClaim("count", 7)).toBe("7");
    });

    // A claim named `document` that is not an object still has to render.
    it("does not mistake a plain string for a structured claim", () => {
      expect(formatClaim("document", "1020304050")).toBe("1020304050");
      expect(formatClaim("allergies", "Penicillin")).toBe("Penicillin");
    });
  });
});

describe("initialsOf", () => {
  it.each([
    ["Camila Rodríguez García", "CR"],
    ["Camila", "C"],
    ["  Camila   Rodríguez  ", "CR"],
  ])("turns %o into %o", (name, expected) => {
    expect(initialsOf({ name })).toBe(expected);
  });

  it.each([{}, { name: "" }, { name: "   " }, { name: 42 }])(
    "shows a placeholder for %o",
    (claims) => {
      expect(initialsOf(claims)).toBe("··");
    },
  );
});
