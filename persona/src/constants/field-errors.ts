// What a `ValidationError` puts in `fields`. Codes, not sentences: the web app
// holds the wording, in English and Spanish, and a user should never be shown a
// string this server wrote.
//
// The names are the contract. Anything added here needs a matching entry in
// `errors.fields` in the web app's strings.ts, or the message falls back to a
// generic apology.
export const FIELD_ERRORS = {
  REQUIRED: 'REQUIRED',
  TOO_SHORT: 'TOO_SHORT',
  TOO_LONG: 'TOO_LONG',
  EMPTY_LIST: 'EMPTY_LIST',
  TOO_MANY: 'TOO_MANY',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_URL: 'INVALID_URL',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_CODE: 'INVALID_CODE',
  PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
  URL_HAS_FRAGMENT: 'URL_HAS_FRAGMENT',
  NOT_ALLOWED: 'NOT_ALLOWED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  UNKNOWN_SCOPE: 'UNKNOWN_SCOPE',
  REQUIRED_NOT_ALLOWED: 'REQUIRED_NOT_ALLOWED',
  INVALID_TYPE: 'INVALID_TYPE',
  UNEXPECTED_FIELD: 'UNEXPECTED_FIELD',
  INVALID_VALUE: 'INVALID_VALUE',
} as const;

export type FieldError = (typeof FIELD_ERRORS)[keyof typeof FIELD_ERRORS];
