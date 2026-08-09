import { describe, expect, it } from "vitest";
import {
  addressDetail,
  docDetail,
  nameDetail,
  phoneDetail,
  type AddressDetail,
  type DocumentDetail,
  type ItemDetail,
  type NameDetail,
  type PhoneDetail,
} from "./types";

// The four detail shapes arrive as untagged JSON, so each guard picks a property
// only its own shape has. That is duck typing and it is fragile: adding a
// `firstName` to addresses, say, would silently reroute them. These pin the
// discrimination so such a change fails here rather than in the UI.
const document: DocumentDetail = { type: "CC", issueDate: "2015-04-02", issuePlace: "Bogotá" };
const name: NameDetail = { firstName: "Camila", lastName: "Rodríguez" };
const phone: PhoneDetail = { countryCode: "+57", number: "3001234567" };
const address: AddressDetail = { line1: "Cra 7 # 45-10", city: "Bogotá", country: "CO" };

const guards = [
  ["docDetail", docDetail, document],
  ["nameDetail", nameDetail, name],
  ["phoneDetail", phoneDetail, phone],
  ["addressDetail", addressDetail, address],
] as const;

describe("detail guards", () => {
  it.each(guards)("%s recognises its own shape", (_label, guard, detail) => {
    expect(guard(detail as ItemDetail)).toBe(detail);
  });

  it.each(guards)("%s rejects null", (_label, guard) => {
    expect(guard(null)).toBeNull();
  });

  it.each(guards)("%s rejects every other shape", (label, guard) => {
    const others = guards.filter(([other]) => other !== label).map(([, , detail]) => detail);
    for (const other of others) {
      expect(guard(other as ItemDetail)).toBeNull();
    }
  });

  it("does not confuse a document with a name", () => {
    // Both are the "person's identity" shapes and the pair most likely to be
    // handed to the wrong guard.
    expect(docDetail(name as ItemDetail)).toBeNull();
    expect(nameDetail(document as ItemDetail)).toBeNull();
  });

  it("recognises an address that only has its required parts", () => {
    expect(addressDetail(address as ItemDetail)).toBe(address);
    expect(addressDetail({ ...address, line2: "Apt 4", postalCode: "110111" } as ItemDetail))
      .toBeTruthy();
  });
});
