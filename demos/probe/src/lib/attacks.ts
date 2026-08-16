import { createHash, randomBytes } from "node:crypto";
import { persona, redirectUri } from "./persona";

// Ten things a hostile relying party would try. Each one runs against the real
// provider over HTTP — nothing here is stubbed, and nothing is scored by
// inspecting Persona's source.
//
// A run reports "held" only when the defence demonstrably held. A check that
// could not tell reports "unknown" and is never allowed to read as a pass —
// an evaluation that grades itself generously is worth nothing. Any "broken"
// row is a real finding and belongs in the report as one.

export type AttackId =
  | "scope-elevation"
  | "redirect-tampering"
  | "client-impersonation"
  | "forged-token"
  | "vault-raiding"
  | "audit-tampering"
  | "scope-smuggling"
  | "consent-bypass"
  | "code-replay"
  | "revocation-replay";

export interface Attack {
  id: AttackId;
  title: string;
  threat: string;
  method: string;
  expected: string;
  // Needs a live access token, so Probe has to be connected first.
  needsSession: boolean;
  // Ends the session when it runs, so it is held back behind its own button.
  destructive?: boolean;
}

// "held"    — the attack was demonstrably refused.
// "broken"  — it got through. A real finding.
// "unknown" — the run proved nothing either way (not connected, network error,
//             or a precondition the person has not performed yet).
export type Status = "held" | "broken" | "unknown";

export interface Outcome {
  request: string;
  response: string;
  status: Status;
  detail?: string;
}

export interface Context {
  accessToken?: string;
  // The authorization code already spent at the callback, kept so it can be
  // offered a second time.
  usedCode?: string;
}

export const ATTACKS: Attack[] = [
  {
    id: "scope-elevation",
    title: "Ask for data it never registered",
    threat: "Disclosure — relying party over-collection",
    method: "Authorize with scope document blood_type allergies, none of which Probe registered for.",
    expected: "Refused with invalid_scope before any consent screen is shown.",
    needsSession: false,
  },
  {
    id: "redirect-tampering",
    title: "Send the code somewhere else",
    threat: "Disclosure — authorization code interception",
    method: "Authorize with redirect_uri pointing at a host Probe does not own.",
    expected: "Refused outright. The provider must not redirect to an unregistered URI, not even to report the error.",
    needsSession: false,
  },
  {
    id: "client-impersonation",
    title: "Use the token endpoint without the secret",
    threat: "Spoofing — client impersonation",
    method: "Exchange at /oidc/token with the wrong client secret.",
    expected: "401. Client authentication fails before the grant is looked at.",
    needsSession: false,
  },
  {
    id: "forged-token",
    title: "Invent an access token",
    threat: "Spoofing — token forgery",
    method: "Call /oidc/me with a random bearer token.",
    expected: "401. Tokens are opaque and checked against storage, so one cannot be guessed.",
    needsSession: false,
  },
  {
    id: "vault-raiding",
    title: "Read the vault directly with an OAuth token",
    threat: "Disclosure — broken access control",
    method: "Call Persona's own /api/vault with Probe's access token instead of going through userinfo.",
    expected: "401. An OAuth token grants the consented claims, not the person's account.",
    needsSession: true,
  },
  {
    id: "audit-tampering",
    title: "Erase the evidence",
    threat: "Non-repudiation — audit-log tampering",
    method: "Attempt to delete the person's release history through /api/audit.",
    expected: "No write surface exists. The log is append-only from outside.",
    needsSession: true,
  },
  {
    id: "scope-smuggling",
    title: "Widen the grant at the token endpoint",
    threat: "Elevation — scope escalation after consent",
    method: "Send extra scopes in the token request, after the person has already consented.",
    expected: "The extra scopes are refused or ignored. What was consented is what is granted.",
    needsSession: false,
  },
  {
    id: "consent-bypass",
    title: "Read what the person declined",
    threat: "Disclosure — consent bypass",
    method: "Call /oidc/me and inspect every claim that comes back for anything outside the granted scopes.",
    expected: "Only consented fields are present. This is the project's central claim, checked from the outside.",
    needsSession: true,
  },
  {
    id: "code-replay",
    title: "Spend the same code twice",
    threat: "Replay — authorization code reuse",
    method: "Offer the already-spent authorization code at /oidc/token a second time.",
    expected: "Refused. Correct providers also revoke the whole grant on reuse, so this ends the session.",
    needsSession: true,
    destructive: true,
  },
  {
    id: "revocation-replay",
    title: "Keep using a revoked token",
    threat: "Replay — use after revocation",
    method: "Hold the access token, have the person revoke Probe in Persona, then call /oidc/me again.",
    expected: "401 immediately. Revocation is not advisory.",
    needsSession: true,
  },
];

export const attackById = (id: string): Attack | undefined =>
  ATTACKS.find((attack) => attack.id === id);

// ---------------------------------------------------------------------------

const RANDOM_TOKEN = "not-a-real-token-0000000000000000000000000000";

// Scopes Probe deliberately did not register for. Health data, from a client
// that told Persona it was a social app.
const GREEDY_SCOPES = ["document", "blood_type", "allergies"];

const EVIL_HOST = "http://probe-exfil.example";

const shorten = (text: string, limit = 220): string =>
  text.length > limit ? `${text.slice(0, limit)}…` : text;

async function describe(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  const trimmed = body.replace(/\s+/g, " ").trim();
  return trimmed ? `${response.status} — ${shorten(trimmed)}` : `${response.status}`;
}

function authorizeQuery(overrides: Record<string, string> = {}): string {
  const verifier = randomBytes(32).toString("base64url");
  return new URLSearchParams({
    client_id: persona.clientId,
    response_type: "code",
    scope: "openid name username",
    redirect_uri: redirectUri(),
    state: randomBytes(16).toString("base64url"),
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    ...overrides,
  }).toString();
}

// The authorize endpoint answers in one of two ways, and which one it picks is
// itself the security behaviour: a redirect carrying an error means the URI was
// trusted enough to answer to, and a rendered error means it was not.
async function authorize(overrides: Record<string, string>) {
  const url = `${persona.internalUrl}/oidc/auth?${authorizeQuery(overrides)}`;
  const response = await fetch(url, { redirect: "manual" });
  return { url, response, location: response.headers.get("location") ?? "" };
}

async function tokenRequest(
  body: Record<string, string>,
  secret = persona.clientSecret,
): Promise<Response> {
  const credentials = Buffer.from(`${persona.clientId}:${secret}`).toString("base64");
  return fetch(`${persona.internalUrl}/oidc/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

// ---------------------------------------------------------------------------

const RUNNERS: Record<AttackId, (context: Context) => Promise<Outcome>> = {
  async "scope-elevation"() {
    const scope = `openid name username ${GREEDY_SCOPES.join(" ")}`;
    const { response, location } = await authorize({ scope });
    const error = new URLSearchParams(location.split("?")[1] ?? "").get("error");

    return {
      request: `GET /oidc/auth?scope=${encodeURIComponent(scope)}`,
      response: location ? `${response.status} → ${shorten(location, 160)}` : await describe(response),
      status: error === "invalid_scope" ? "held" : "broken",
      detail:
        error === "invalid_scope"
          ? "Refused before a consent screen existed, so the person was never asked to approve health data at all."
          : "Expected invalid_scope. Anything else means the registered scope list is not binding the request.",
    };
  },

  async "redirect-tampering"() {
    const evil = `${EVIL_HOST}/callback`;
    const { response, location } = await authorize({ redirect_uri: evil });
    const leaked = location.startsWith(EVIL_HOST);

    return {
      request: `GET /oidc/auth?redirect_uri=${evil}`,
      response: location ? `${response.status} → ${shorten(location, 160)}` : await describe(response),
      status: !leaked && response.status !== 302 && response.status !== 303 ? "held" : "broken",
      detail: leaked
        ? "The provider redirected to an unregistered host. This is a serious finding."
        : "No redirect issued. An unregistered URI is not answered to, so a stolen code has nowhere to land.",
    };
  },

  async "client-impersonation"() {
    const response = await tokenRequest(
      {
        grant_type: "authorization_code",
        code: "any-code-would-do",
        redirect_uri: redirectUri(),
        code_verifier: randomBytes(32).toString("base64url"),
      },
      "definitely-the-wrong-secret",
    );

    return {
      request: "POST /oidc/token with Basic probe:definitely-the-wrong-secret",
      response: await describe(response),
      status: response.status === 401 ? "held" : "broken",
      detail:
        "Client authentication is checked before the code is, so a wrong secret cannot be used to probe which codes exist.",
    };
  },

  async "forged-token"() {
    const response = await fetch(`${persona.internalUrl}/oidc/me`, {
      headers: bearer(RANDOM_TOKEN),
      cache: "no-store",
    });

    return {
      request: `GET /oidc/me with Bearer ${RANDOM_TOKEN.slice(0, 16)}…`,
      response: await describe(response),
      status: response.status === 401 ? "held" : "broken",
      detail: "Tokens are opaque and looked up in storage — there is no signature to forge.",
    };
  },

  async "vault-raiding"({ accessToken }) {
    if (!accessToken) return notConnected("GET /api/vault");

    const response = await fetch(`${persona.internalUrl}/api/vault`, {
      headers: bearer(accessToken),
      cache: "no-store",
    });

    return {
      request: "GET /api/vault with Probe's access token",
      response: await describe(response),
      status: response.status === 401 || response.status === 403 ? "held" : "broken",
      detail:
        "The vault API belongs to the person's own session, not to OAuth. Holding a token for two claims is not a key to the account.",
    };
  },

  async "audit-tampering"({ accessToken }) {
    if (!accessToken) return notConnected("DELETE /api/audit");

    const response = await fetch(`${persona.internalUrl}/api/audit`, {
      method: "DELETE",
      headers: bearer(accessToken),
    });

    return {
      request: "DELETE /api/audit with Probe's access token",
      response: await describe(response),
      status:
        response.status === 401 || response.status === 403 || response.status === 404
          ? "held"
          : "broken",
      detail:
        "Refused twice over. Authentication rejects it first — an OAuth token is not a session — and /api/audit exposes only GET, so there is no delete route waiting behind it either.",
    };
  },

  async "scope-smuggling"() {
    const response = await tokenRequest({
      grant_type: "authorization_code",
      code: "any-code-would-do",
      redirect_uri: redirectUri(),
      code_verifier: randomBytes(32).toString("base64url"),
      scope: `openid name username ${GREEDY_SCOPES.join(" ")}`,
    });
    const body = await response.text();

    return {
      request: `POST /oidc/token with scope=…${GREEDY_SCOPES.join(" ")}`,
      response: `${response.status} — ${shorten(body.replace(/\s+/g, " ").trim())}`,
      // The grant is rejected on the code, which is the point: scope is not a
      // parameter this endpoint accepts as an instruction.
      status:
        response.status >= 400 && !GREEDY_SCOPES.some((scope) => body.includes(scope))
          ? "held"
          : "broken",
      detail:
        "Scope is fixed when the person consents. The token endpoint has no widening path, so nothing extra can be smuggled in later.",
    };
  },

  async "consent-bypass"({ accessToken }) {
    if (!accessToken) return notConnected("GET /oidc/me");

    const response = await fetch(`${persona.internalUrl}/oidc/me`, {
      headers: bearer(accessToken),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        request: "GET /oidc/me",
        response: await describe(response),
        status: "unknown",
        detail: "Could not read userinfo, so this check proved nothing. Reconnect and run it again.",
      };
    }

    const claims = (await response.json()) as Record<string, unknown>;
    const returned = Object.keys(claims).filter((key) => key !== "sub");
    const beyond = returned.filter((key) => !["name", "username"].includes(key));

    return {
      request: "GET /oidc/me",
      response: `200 — claims: ${returned.join(", ") || "(none)"}`,
      status: beyond.length === 0 ? "held" : "broken",
      detail:
        beyond.length === 0
          ? "Only the two registered claims came back. Probe asked Persona for everything it could and received a name and a handle."
          : `Received ${beyond.join(", ")} without consent. This is a leak and a serious finding.`,
    };
  },

  async "code-replay"({ usedCode }) {
    if (!usedCode) {
      return {
        request: "POST /oidc/token (replay)",
        response: "not run",
        status: "unknown",
        detail: "No spent code recorded. Connect first — the code is captured as it is exchanged.",
      };
    }

    const response = await tokenRequest({
      grant_type: "authorization_code",
      code: usedCode,
      redirect_uri: redirectUri(),
      code_verifier: randomBytes(32).toString("base64url"),
    });

    return {
      request: `POST /oidc/token with the already-spent code ${usedCode.slice(0, 12)}…`,
      response: await describe(response),
      status: response.status >= 400 ? "held" : "broken",
      detail:
        "A reused code is refused, and the provider treats the reuse as evidence of theft and drops the whole grant. That is why this one ends the session.",
    };
  },

  async "revocation-replay"({ accessToken }) {
    if (!accessToken) return notConnected("GET /oidc/me after revocation");

    const response = await fetch(`${persona.internalUrl}/oidc/me`, {
      headers: bearer(accessToken),
      cache: "no-store",
    });

    return {
      request: "GET /oidc/me holding the token after revocation",
      response: await describe(response),
      // Only meaningful once the person has actually revoked. A token that
      // still works because nobody revoked it is not a failure, and it is not a
      // pass either — so it reports neither.
      status: response.status === 401 ? "held" : "unknown",
      detail:
        response.status === 401
          ? "The token stopped working. Revocation takes effect at the next call, not at the next login."
          : "Still valid — which is correct if Probe has not been revoked yet. Revoke it in Persona, then run this again.",
    };
  },
};

function notConnected(request: string): Outcome {
  return {
    request,
    response: "not run",
    status: "unknown",
    detail: "Needs a live access token. Connect Probe to Persona first.",
  };
}

export async function runAttack(id: AttackId, context: Context): Promise<Outcome> {
  try {
    return await RUNNERS[id](context);
  } catch (error) {
    return {
      request: id,
      response: "network error",
      status: "unknown",
      detail: `Could not reach Persona: ${error instanceof Error ? error.message : "unknown"}. Nothing was proved either way.`,
    };
  }
}

export async function runAll(context: Context): Promise<Record<string, Outcome>> {
  const safe = ATTACKS.filter((attack) => !attack.destructive);
  const outcomes = await Promise.all(safe.map((attack) => runAttack(attack.id, context)));

  return Object.fromEntries(safe.map((attack, index) => [attack.id, outcomes[index]]));
}
