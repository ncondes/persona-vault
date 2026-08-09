import { describe, expect, it } from "vitest";
import { snapshotText } from "./shared-value";
import { getStrings } from "./strings";
import type { Connection, ItemDetail } from "./types";

const t = getStrings("en");
const es = getStrings("es");

type Shared = Connection["shared"][number];

const shared = (
  scope: string,
  value: string,
  extra: { label?: string | null; detail?: ItemDetail | null } = {},
): Shared =>
  ({
    scope,
    sensitive: false,
    snapshot: [{ label: extra.label ?? null, value, detail: extra.detail ?? null }],
  }) as Shared;

const name: ItemDetail = { firstName: "Camila", lastName: "Rodríguez García" };
const document: ItemDetail = { type: "CC", issueDate: "2015-04-02", issuePlace: "Bogotá" };

// This is the transparency screen: it tells a person exactly what an app holds.
// It has to show the value the way they would recognise it, and it must never
// show more of the name than was actually shared.
describe("snapshotText", () => {
  it("shows a plain value as-is", () => {
    expect(snapshotText(t, shared("email", "camila@example.com"))).toBe("camila@example.com");
  });

  it("appends the person's own label when they gave one", () => {
    expect(snapshotText(t, shared("email", "work@acme.co", { label: "Work" }))).toBe(
      "work@acme.co (Work)",
    );
  });

  // The app got one part of the name, so showing the whole name here would
  // overstate what it holds.
  it("shows only the part of the name that was shared", () => {
    expect(snapshotText(t, shared("given_name", "Camila Rodríguez García", { detail: name }))).toBe(
      "Camila",
    );
    expect(
      snapshotText(t, shared("family_name", "Camila Rodríguez García", { detail: name })),
    ).toBe("Rodríguez García");
  });

  it("shows the whole name for the plain name scope", () => {
    expect(snapshotText(t, shared("name", "Camila Rodríguez García", { detail: name }))).toBe(
      "Camila Rodríguez García",
    );
  });

  it("turns catalog codes into their labels", () => {
    expect(snapshotText(t, shared("blood_type", "O_POS"))).toBe(t.catalog.bloodTypes.O_POS);
    expect(snapshotText(t, shared("eps", "SANITAS"))).toBe(t.catalog.epsProviders.SANITAS);
  });

  it("translates those labels with the rest of the interface", () => {
    expect(snapshotText(es, shared("eps", "SANITAS"))).toBe(es.catalog.epsProviders.SANITAS);
  });

  it("prefixes a document number with its type", () => {
    expect(snapshotText(t, shared("document", "1020304050", { detail: document }))).toBe(
      "CC 1020304050",
    );
  });

  it("joins several shared values with commas", () => {
    const allergies = {
      scope: "allergies",
      sensitive: true,
      snapshot: [
        { label: null, value: "Penicillin", detail: null },
        { label: null, value: "Peanuts", detail: null },
      ],
    } as Shared;

    expect(snapshotText(t, allergies)).toBe("Penicillin, Peanuts");
  });

  it("shows nothing when nothing was shared", () => {
    expect(snapshotText(t, { scope: "email", sensitive: false, snapshot: [] } as Shared)).toBe("");
  });

  describe("falling back rather than hiding the value", () => {
    it("keeps an unrecognised catalog code visible", () => {
      expect(snapshotText(t, shared("blood_type", "NOT_A_CODE"))).toBe("NOT_A_CODE");
    });

    it("keeps the name value when the parts were never stored", () => {
      expect(snapshotText(t, shared("given_name", "Prince", { detail: null }))).toBe("Prince");
    });

    it("keeps the number when the document detail is missing", () => {
      expect(snapshotText(t, shared("document", "1020304050", { detail: null }))).toBe(
        "1020304050",
      );
    });
  });
});
