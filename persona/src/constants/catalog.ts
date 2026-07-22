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

// Countries offered for phone prefixes and addresses (ISO code + dial code).
// The frontend derives the flag from the ISO code.
export const COUNTRIES = [
  { code: 'CO', dial: '+57' },
  { code: 'AR', dial: '+54' },
  { code: 'BR', dial: '+55' },
  { code: 'CA', dial: '+1' },
  { code: 'CL', dial: '+56' },
  { code: 'EC', dial: '+593' },
  { code: 'ES', dial: '+34' },
  { code: 'GB', dial: '+44' },
  { code: 'MX', dial: '+52' },
  { code: 'PA', dial: '+507' },
  { code: 'PE', dial: '+51' },
  { code: 'US', dial: '+1' },
  { code: 'VE', dial: '+58' },
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type BloodType = (typeof BLOOD_TYPES)[number];
export type EpsProvider = (typeof EPS_PROVIDERS)[number];
