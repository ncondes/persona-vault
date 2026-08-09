import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Everything this app needs to talk to Persona. Self-contained on purpose: each
// demo is a complete integration example you can lift into another project.
export const persona = {
  // The browser is redirected here, so it must be an address the browser can
  // reach. Inside Docker the server-to-server calls use a different host.
  publicUrl: process.env.PERSONA_PUBLIC_URL ?? "http://localhost:4400",
  internalUrl: process.env.PERSONA_INTERNAL_URL ?? "http://localhost:4400",
  webUrl: process.env.PERSONA_WEB_URL ?? "http://localhost:4420",
  clientId: process.env.CLIENT_ID ?? "store",
  clientSecret: process.env.CLIENT_SECRET ?? "store-dev-secret",
  appUrl: process.env.APP_URL ?? "http://localhost:4413",
};

// Enough to address a parcel and tell someone it shipped. No date of birth, no
// identity document: a shop is not a border crossing.
export const SCOPE = "openid username name email phone address";

export const SESSION_COOKIE = "store_session";
export const STATE_COOKIE = "store_oauth_state";
export const VERIFIER_COOKIE = "store_oauth_verifier";

export const redirectUri = () => `${persona.appUrl}/callback`;

export function newVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function newState(): string {
  return randomBytes(16).toString("base64url");
}

// Constant-time so the comparison cannot be probed a character at a time.
export function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function authorizeUrl(state: string, challenge: string): string {
  const query = new URLSearchParams({
    client_id: persona.clientId,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: redirectUri(),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${persona.publicUrl}/oidc/auth?${query.toString()}`;
}

export async function exchangeCode(code: string, verifier: string): Promise<string> {
  const credentials = Buffer.from(`${persona.clientId}:${persona.clientSecret}`).toString("base64");
  const res = await fetch(`${persona.internalUrl}/oidc/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status}`);
  }
  const payload = (await res.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("token response had no access_token");
  return payload.access_token;
}

export type Claims = Record<string, unknown>;

// The claims live at the userinfo endpoint, not in the ID token. Reading them
// on every load means a change of address in Persona reaches the next order.
export async function fetchClaims(accessToken: string): Promise<Claims | null> {
  const res = await fetch(`${persona.internalUrl}/oidc/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Claims;
}
