import { describe, expect, it } from "vitest";
import { dialOptions } from "./dial-codes";

// The real catalog, which is where the bug came from: CA and US both dial +1.
const CATALOG = [
  { code: "CO", dial: "+57" },
  { code: "AR", dial: "+54" },
  { code: "BR", dial: "+55" },
  { code: "CA", dial: "+1" },
  { code: "CL", dial: "+56" },
  { code: "EC", dial: "+593" },
  { code: "ES", dial: "+34" },
  { code: "GB", dial: "+44" },
  { code: "MX", dial: "+52" },
  { code: "PA", dial: "+507" },
  { code: "PE", dial: "+51" },
  { code: "US", dial: "+1" },
  { code: "VE", dial: "+58" },
];

describe("dialOptions", () => {
  it("offers each dial once", () => {
    const dials = dialOptions(CATALOG).map((o) => o.dial);

    expect(dials).toHaveLength(new Set(dials).size);
    expect(dials.filter((d) => d === "+1")).toHaveLength(1);
    expect(dials).toHaveLength(CATALOG.length - 1); // CA and US collapse to one
  });

  // Radix keys its internal option list by value, so a repeat is both a React
  // duplicate-key error and a genuinely ambiguous choice.
  it("gives every option a value that identifies it", () => {
    const values = dialOptions(CATALOG).map((o) => o.dial);
    expect(new Set(values).size).toBe(values.length);
  });

  it("keeps the flag when only one country uses the dial", () => {
    const options = dialOptions(CATALOG);

    expect(options.find((o) => o.dial === "+57")).toEqual({ dial: "+57", code: "CO" });
    expect(options.find((o) => o.dial === "+44")).toEqual({ dial: "+44", code: "GB" });
  });

  it("drops the flag when the dial is shared, rather than picking a side", () => {
    expect(dialOptions(CATALOG).find((o) => o.dial === "+1")).toEqual({
      dial: "+1",
      code: null,
    });
  });

  it("keeps the catalog's order, with the first claim holding the place", () => {
    expect(dialOptions(CATALOG).map((o) => o.dial)).toEqual([
      "+57",
      "+54",
      "+55",
      "+1",
      "+56",
      "+593",
      "+34",
      "+44",
      "+52",
      "+507",
      "+51",
      "+58",
    ]);
  });

  it("handles an empty catalog, which is what renders before it loads", () => {
    expect(dialOptions([])).toEqual([]);
  });

  it("collapses three countries on one dial just as well as two", () => {
    expect(
      dialOptions([
        { code: "US", dial: "+1" },
        { code: "CA", dial: "+1" },
        { code: "JM", dial: "+1" },
      ]),
    ).toEqual([{ dial: "+1", code: null }]);
  });
});
