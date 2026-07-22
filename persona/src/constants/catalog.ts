// Fixed code lists for vault values. The backend stores codes only; display
// labels live in the frontend.

// Colombian identity document types (cédula, tarjeta de identidad, cédula de
// extranjería, passport, permiso de protección temporal).
export const DOCUMENT_TYPES = ['CC', 'TI', 'CE', 'PASSPORT', 'PEP_PPT'] as const;

export const BLOOD_TYPES = [
  'A_POS',
  'A_NEG',
  'B_POS',
  'B_NEG',
  'AB_POS',
  'AB_NEG',
  'O_POS',
  'O_NEG',
] as const;

// Colombian health insurers (EPS).
export const EPS_PROVIDERS = [
  'SURA',
  'SANITAS',
  'NUEVA_EPS',
  'SALUD_TOTAL',
  'COMPENSAR',
  'FAMISANAR',
  'COOSALUD',
  'MUTUAL_SER',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type BloodType = (typeof BLOOD_TYPES)[number];
export type EpsProvider = (typeof EPS_PROVIDERS)[number];
