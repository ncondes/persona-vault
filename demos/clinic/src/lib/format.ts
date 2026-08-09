import type { Claims } from "./persona";

// Persona releases codes for the fixed catalogues; the display labels belong to
// whoever is showing them.
const BLOOD_TYPES: Record<string, string> = {
  A_POS: "A+",
  A_NEG: "A−",
  B_POS: "B+",
  B_NEG: "B−",
  AB_POS: "AB+",
  AB_NEG: "AB−",
  O_POS: "O+",
  O_NEG: "O−",
};

const EPS: Record<string, string> = {
  SURA: "Sura",
  SANITAS: "Sanitas",
  NUEVA_EPS: "Nueva EPS",
  SALUD_TOTAL: "Salud Total",
  COMPENSAR: "Compensar",
  FAMISANAR: "Famisanar",
  COOSALUD: "Coosalud",
  MUTUAL_SER: "Mutual Ser",
};

const DOCUMENT_TYPES: Record<string, string> = {
  CC: "Cédula de ciudadanía",
  TI: "Tarjeta de identidad",
  CE: "Cédula de extranjería",
  PASSPORT: "Passport",
  PEP_PPT: "PEP / PPT",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Turns one claim into the single line a form field shows. Returns null when
// the person did not share it, so the caller can render a blank rule instead.
export function formatClaim(scope: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;

  if (scope === "blood_type" && typeof value === "string") {
    return BLOOD_TYPES[value] ?? value;
  }
  if (scope === "eps" && typeof value === "string") {
    return EPS[value] ?? value;
  }
  if (scope === "allergies" && Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : null;
  }
  if (scope === "document" && isRecord(value)) {
    const type = typeof value.type === "string" ? DOCUMENT_TYPES[value.type] ?? value.type : null;
    const number = typeof value.number === "string" ? value.number : null;
    if (!number) return null;
    return type ? `${type} · ${number}` : number;
  }
  if (scope === "address" && isRecord(value)) {
    return typeof value.formatted === "string" ? value.formatted : null;
  }
  if (scope === "birth_date" && typeof value === "string") {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.valueOf())
      ? value
      : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function initialsOf(claims: Claims): string {
  const name = typeof claims.name === "string" ? claims.name : "";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "··";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}
