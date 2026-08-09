import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorizeUrl,
  challengeFor,
  exchangeCode,
  fetchClaims,
  newState,
  newVerifier,
  persona,
  redirectUri,
  sameState,
  SCOPE,
} from "./persona";

// The security-critical half of a relying party: PKCE and the state check. Both
// are pure, so they can be checked against the specification rather than merely
// observed to work.
describe("PKCE", () => {
  // RFC 7636 Appendix B. Matching the published vector proves the transform is
  // the one the specification defines — SHA-256 then base64url, no padding, no
  // hex — rather than something that merely looks plausible.
  it("matches the RFC 7636 test vector", () => {
    expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("is deterministic", () => {
    const verifier = newVerifier();
    expect(challengeFor(verifier)).toBe(challengeFor(verifier));
  });

  it("gives a different challenge for a different verifier", () => {
    expect(challengeFor("a")).not.toBe(challengeFor("b"));
  });

  it("produces base64url with no padding, so it survives a query string", () => {
    expect(challengeFor(newVerifier())).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("newVerifier", () => {
  // RFC 7636 requires 43-128 characters from the unreserved set.
  it("is a 43-character base64url string, as the spec requires", () => {
    expect(newVerifier()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("is different every time", () => {
    const seen = new Set(Array.from({ length: 50 }, newVerifier));
    expect(seen.size).toBe(50);
  });
});

describe("newState", () => {
  it("is a url-safe random string", () => {
    expect(newState()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("is different every time", () => {
    const seen = new Set(Array.from({ length: 50 }, newState));
    expect(seen.size).toBe(50);
  });
});

// state is the CSRF defence on the callback: it proves the response belongs to
// a request this browser started.
describe("sameState", () => {
  it("accepts a value that matches", () => {
    const state = newState();
    expect(sameState(state, state)).toBe(true);
  });

  it("rejects a different value of the same length", () => {
    expect(sameState("abcdefghij", "abcdefghix")).toBe(false);
  });

  // The length guard matters twice: timingSafeEqual throws on mismatched
  // lengths, so without it a forged callback would crash the route instead of
  // being refused.
  it("rejects a value of a different length without throwing", () => {
    expect(() => sameState("short", "considerably-longer")).not.toThrow();
    expect(sameState("short", "considerably-longer")).toBe(false);
  });

  it.each([
    ["", ""],
    ["", "x"],
    ["x", ""],
  ])("handles the empty pair (%o, %o)", (a, b) => {
    expect(sameState(a, b)).toBe(a === b);
  });

  it("compares bytes, not characters", () => {
    // Same length in characters, different in UTF-8 bytes.
    expect(sameState("é", "ee")).toBe(false);
  });
});

describe("authorizeUrl", () => {
  const url = () => new URL(authorizeUrl("the-state", "the-challenge"));

  it("points at the browser-facing host, not the internal one", () => {
    expect(authorizeUrl("s", "c").startsWith(`${persona.publicUrl}/oidc/auth?`)).toBe(true);
  });

  it("sends every parameter the authorization-code flow needs", () => {
    const params = url().searchParams;

    expect(params.get("client_id")).toBe(persona.clientId);
    expect(params.get("response_type")).toBe("code");
    expect(params.get("scope")).toBe(SCOPE);
    expect(params.get("redirect_uri")).toBe(redirectUri());
    expect(params.get("state")).toBe("the-state");
    expect(params.get("code_challenge")).toBe("the-challenge");
    expect(params.get("code_challenge_method")).toBe("S256");
  });

  // Built with URLSearchParams, so the spaces between scopes are encoded rather
  // than breaking the query.
  it("encodes the spaces in the scope list", () => {
    const raw = authorizeUrl("s", "c");
    expect(raw).not.toMatch(/scope=[^&]* /);
    expect(raw).toContain("scope=openid+name+email");
  });

  it("encodes the redirect URI", () => {
    expect(authorizeUrl("s", "c")).toContain("redirect_uri=http%3A%2F%2F");
  });

  it("encodes a state containing url-unsafe characters", () => {
    const params = new URL(authorizeUrl("a+b/c=d&e", "c")).searchParams;
    expect(params.get("state")).toBe("a+b/c=d&e");
  });

  it("asks for openid first, so this is an OIDC request", () => {
    expect(SCOPE.split(" ")[0]).toBe("openid");
  });
});

describe("configuration", () => {
  it("sends the browser somewhere it can reach", () => {
    expect(persona.publicUrl).toMatch(/^https?:\/\//);
    expect(redirectUri()).toBe(`${persona.appUrl}/callback`);
  });

  // Two hosts on purpose: the browser redirect and the server-to-server calls
  // reach Persona by different names under Docker.
  it("keeps the internal URL separate from the public one", () => {
    expect(persona.internalUrl).toMatch(/^https?:\/\//);
    expect(typeof persona.clientSecret).toBe("string");
  });
});

describe("fetchClaims", () => {
  afterEach(() => vi.unstubAllGlobals());

  // The claims live at the userinfo endpoint, not in the ID token. Reading them
  // is also what Persona records in the person's audit log, so an app that only
  // decoded the ID token would leave no trace of having taken the data.
  it("reads the claims from the userinfo endpoint with the bearer token", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sub: "user-1", name: "Camila R." }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchClaims("an-access-token")).resolves.toEqual({
      sub: "user-1",
      name: "Camila R.",
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${persona.internalUrl}/oidc/me`);
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer an-access-token");
    // Never cached: the person may have revoked or edited since the last call.
    expect(init.cache).toBe("no-store");
  });

  // Revoking in Persona makes the token fail here. Returning null rather than
  // throwing is what lets the home page fall back to the signed-out view.
  it.each([401, 403, 500])("returns null when Persona answers %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status, json: async () => ({}) })));

    await expect(fetchClaims("a-revoked-token")).resolves.toBeNull();
  });
});

describe("exchangeCode", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("authenticates with HTTP Basic and returns the access token", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: "an-access-token" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(exchangeCode("the-code", "the-verifier")).resolves.toBe("an-access-token");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const expected = Buffer.from(`${persona.clientId}:${persona.clientSecret}`).toString("base64");

    // Server-to-server, so the internal host — and the secret never reaches the
    // browser.
    expect(url).toBe(`${persona.internalUrl}/oidc/token`);
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${expected}`);
    expect(new URLSearchParams(init.body as string).get("code_verifier")).toBe("the-verifier");
  });

  it("throws when the exchange is refused", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));

    await expect(exchangeCode("bad-code", "v")).rejects.toThrow(/401/);
  });

  it("throws when the response carries no token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));

    await expect(exchangeCode("the-code", "v")).rejects.toThrow(/no access_token/);
  });
});
