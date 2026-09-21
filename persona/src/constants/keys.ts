// The rollover schedule.
//
// The only artifact Persona signs with the JWKS key is the ID token. Access
// tokens are opaque and checked against storage, and `grant_types` is fixed to
// authorization_code with no `offline_access` scope, so no refresh token is ever
// issued. That makes the window a retiring key has to stay published the ID
// token's lifetime plus clock tolerance — an hour and a bit — rather than the
// fourteen days a session lasts.
export const KEY_ALG = 'RS256';
export const KEY_MODULUS_BITS = 2048;

// oidc-provider's defaults, which are what this deployment runs on. Named here
// rather than inlined so the arithmetic below can be read without going to look
// them up.
export const ID_TOKEN_TTL_MS = 60 * 60 * 1000;
export const CLOCK_TOLERANCE_MS = 15 * 1000;

// How long a relying party might hold a cached copy of /oidc/jwks. Nothing in
// the spec fixes this; OpenID Connect Core §10.1.1 says a verifier should
// re-fetch when it meets a `kid` it does not know, which makes this a margin
// for the ones that do not. An hour is generous for a set that changes
// quarterly.
export const JWKS_CACHE_MARGIN_MS = 60 * 60 * 1000;

// A new key is published this long before it starts signing, so a relying party
// that caches the set has already seen it by the time a token arrives under it.
export const KEY_PUBLISH_LEAD_MS = JWKS_CACHE_MARGIN_MS;

// How long a retiring key stays published: long enough for every token it signed
// to have expired, plus the cache margin.
export const KEY_RETIRE_AFTER_MS = ID_TOKEN_TTL_MS + CLOCK_TOLERANCE_MS + JWKS_CACHE_MARGIN_MS;

// How often the active key is replaced.
export const KEY_ROTATION_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000;
