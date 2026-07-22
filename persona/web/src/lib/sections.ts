import type { VaultKind } from "./types";

export interface Section {
  id: "identity" | "document" | "contact" | "location" | "health";
  kinds: VaultKind[];
}

// The vault tabs and which kinds each one shows. Birth date sits with
// identity (it belongs next to the name on forms), health stays sensitive-only.
export const SECTIONS: Section[] = [
  { id: "identity", kinds: ["name", "username", "birth_date"] },
  { id: "document", kinds: ["document"] },
  { id: "contact", kinds: ["email", "phone"] },
  { id: "location", kinds: ["address"] },
  { id: "health", kinds: ["blood_type", "eps", "allergy"] },
];
