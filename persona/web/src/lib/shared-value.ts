import type { Strings } from "@/lib/strings";
import { docDetail, nameDetail, type Connection } from "@/lib/types";

// Renders what an app actually holds, from the snapshot taken at consent time.
//
// This is the transparency screen's whole job, so it shows values the way a
// person recognises them: the part of the name the app got rather than the whole
// name, catalog codes as their labels, a document with its type. Anything it
// cannot translate falls through as the stored value rather than disappearing.
export function snapshotText(t: Strings, shared: Connection["shared"][number]): string {
  return shared.snapshot
    .map((s) => {
      let value = s.value;
      const name = nameDetail(s.detail);
      if (shared.scope === "given_name" && name) value = name.firstName;
      if (shared.scope === "family_name" && name) value = name.lastName;
      if (shared.scope === "blood_type") value = t.catalog.bloodTypes[value] ?? value;
      if (shared.scope === "eps") value = t.catalog.epsProviders[value] ?? value;
      const doc = shared.scope === "document" ? docDetail(s.detail) : null;
      if (doc) value = `${doc.type} ${value}`;
      return s.label ? `${value} (${s.label})` : value;
    })
    .join(", ");
}
