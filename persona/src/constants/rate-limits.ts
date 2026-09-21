// Which endpoints are limited, how they are keyed, and how tight. One table
// rather than numbers scattered through the routes, because the interesting
// part is not any single limit — it is being able to say why each endpoint got
// the treatment it got.
//
// Six criteria decide it:
//
//   C1  spends a scarce external resource on an unauthenticated request
//   C2  is a credential or code guessing surface
//   C3  discloses whether an account exists
//   C4  is expensive or amplifying to serve
//   C5  creates durable state
//   C6  is public and cheap
//
// Nothing here keys on IP except C6. The API has no public domain: every
// request reaches it through the web app's rewrites over Railway's private
// network, so `req.ip` is the proxy. Keying a credential limit on that would
// throttle every user at once and no attacker in particular. So the key is
// either the subject making the request, or — before anyone is signed in — the
// account being attacked. Neither can be shifted by the caller.

export type RateLimitKeySource =
  // The address in the request body. The account under attack, not the attacker.
  | 'email'
  // A one-time-code challenge id, from the body.
  | 'challenge'
  // An OIDC interaction uid, from the path.
  | 'interaction'
  // The signed-in user, from the session cookie. Requires requireAuth first.
  | 'user'
  // The OAuth client, from Basic auth at the token endpoint or client_id in the
  // authorize query string.
  | 'client'
  // A hash of the bearer token. Per token, so effectively per client per user,
  // and it costs no database read to work out.
  | 'bearer'
  | 'ip';

// What to do when the store cannot answer. Refusing a login because Redis is
// unreachable is bad; letting an unlimited number of password guesses through
// because Redis is unreachable is worse. Cheap reads get the opposite call.
export type RateLimitFailMode = 'closed' | 'open';

export interface RateLimitPolicy {
  readonly name: string;
  readonly criteria: readonly string[];
  readonly keyOn: RateLimitKeySource;
  // Burst size. Also the number of requests allowed in a cold window.
  readonly limit: number;
  // Time to refill the bucket from empty.
  readonly windowMs: number;
  readonly failMode: RateLimitFailMode;
  // Read back by the docs table and by the report. Says what the limit is for,
  // not what it does.
  readonly reason: string;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RATE_LIMIT_POLICIES = {
  // Sending mail to an address nobody asked about is the one thing here that
  // costs a stranger something, so it is the tightest.
  authRegister: {
    name: 'authRegister',
    criteria: ['C1', 'C3'],
    keyOn: 'email',
    limit: 5,
    windowMs: HOUR,
    failMode: 'closed',
    reason: 'Sign-up spends an email on an unauthenticated request and reveals whether an address is taken.',
  },
  // Shared deliberately between /api/auth/login and /interaction/:uid/login.
  // They are two doors onto the same password check; separate buckets would let
  // an attacker alternate and have twice the budget.
  authLogin: {
    name: 'authLogin',
    criteria: ['C2', 'C3'],
    keyOn: 'email',
    limit: 10,
    windowMs: 15 * MINUTE,
    failMode: 'closed',
    reason: 'Password guessing, on both the API and the consent-screen sign-in, which share one budget per address.',
  },
  authVerify: {
    name: 'authVerify',
    criteria: ['C2'],
    keyOn: 'challenge',
    limit: 10,
    windowMs: MINUTE,
    failMode: 'closed',
    reason: 'Stops a challenge being guessed in parallel. The five-attempt cap already stops it being guessed in series.',
  },
  authResend: {
    name: 'authResend',
    criteria: ['C1'],
    keyOn: 'challenge',
    limit: 10,
    windowMs: HOUR,
    failMode: 'closed',
    reason: 'An outer bound around the per-challenge cooldown and send cap, which do the real work.',
  },
  interactionVerify: {
    name: 'interactionVerify',
    criteria: ['C2'],
    keyOn: 'interaction',
    limit: 10,
    windowMs: MINUTE,
    failMode: 'closed',
    reason: 'The consent screen asks for a code too, so it needs the same guard as the API.',
  },
  // Keyed on the interaction rather than the user: at this point the account id
  // lives inside the interaction, not on the request, and there is no session
  // cookie to read. One authorization attempt gets one budget.
  interactionDecision: {
    name: 'interactionDecision',
    criteria: ['C4'],
    keyOn: 'interaction',
    limit: 30,
    windowMs: MINUTE,
    failMode: 'open',
    reason: 'Each decision writes a consent and an audit entry.',
  },
  oidcToken: {
    name: 'oidcToken',
    criteria: ['C2'],
    keyOn: 'client',
    limit: 60,
    windowMs: MINUTE,
    failMode: 'closed',
    reason: 'The client secret is a credential, and this is where it is checked.',
  },
  oidcUserinfo: {
    name: 'oidcUserinfo',
    criteria: ['C4'],
    keyOn: 'bearer',
    limit: 120,
    windowMs: MINUTE,
    failMode: 'open',
    reason: 'Every call reads the vault and writes an audit entry, so it costs more than it looks.',
  },
  oidcAuthorize: {
    name: 'oidcAuthorize',
    criteria: ['C4'],
    keyOn: 'client',
    limit: 120,
    windowMs: MINUTE,
    failMode: 'open',
    reason: 'Starts an interaction and a session row.',
  },
  apiRead: {
    name: 'apiRead',
    criteria: ['C4'],
    keyOn: 'user',
    limit: 120,
    windowMs: MINUTE,
    failMode: 'open',
    reason: 'Ordinary signed-in reading. Loose enough that a person never meets it.',
  },
  apiExport: {
    name: 'apiExport',
    criteria: ['C4'],
    keyOn: 'user',
    limit: 5,
    windowMs: HOUR,
    failMode: 'open',
    reason: 'Assembles the whole account in one response.',
  },
  vaultWrite: {
    name: 'vaultWrite',
    criteria: ['C5'],
    keyOn: 'user',
    limit: 60,
    windowMs: MINUTE,
    failMode: 'open',
    reason: 'Creates durable rows, one per request.',
  },
  // The registration quota is the app-impersonation vector, not a capacity
  // concern: it is what stops someone minting fifty plausible-looking clinics.
  appCreate: {
    name: 'appCreate',
    criteria: ['C5'],
    keyOn: 'user',
    limit: 10,
    windowMs: DAY,
    failMode: 'closed',
    reason: 'Registering relying parties in bulk is how an impersonation attempt would start.',
  },
  appSecret: {
    name: 'appSecret',
    criteria: ['C2'],
    keyOn: 'user',
    limit: 10,
    windowMs: HOUR,
    failMode: 'closed',
    reason: 'Mints a credential, and each rotation invalidates the one the app is using.',
  },
  appVerify: {
    name: 'appVerify',
    criteria: ['C4'],
    keyOn: 'user',
    limit: 10,
    windowMs: HOUR,
    failMode: 'closed',
    reason: 'Makes the server fetch a URL the developer chose, so it is an outbound request someone else picked.',
  },
  // The number here is set by what key rotation needs, not by what the catalog
  // needs: a relying party re-fetches /oidc/jwks whenever it meets a `kid` it
  // does not know, which is exactly what a rollover causes. Throttling this
  // hard would break the mechanism in the next section over.
  publicRead: {
    name: 'publicRead',
    criteria: ['C6'],
    keyOn: 'ip',
    limit: 600,
    windowMs: MINUTE,
    failMode: 'open',
    reason: 'Public and cheap. The bound is set by JWKS re-fetching during a key rollover, not by the catalog.',
  },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

// GET /api/health is deliberately absent from the table above. A throttled
// health check reads as an outage, and there is nothing behind it to protect.
export const UNLIMITED_PATHS = ['/api/health'] as const;
