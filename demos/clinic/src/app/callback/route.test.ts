import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { persona, STATE_COOKIE, VERIFIER_COOKIE, SESSION_COOKIE } from "@/lib/persona";

// The callback is where an attacker would try to walk in: hand the app a code
// they obtained elsewhere and hope it exchanges it. One guard stands in the way,
// so every way of tripping it is checked.
const STATE = "the-expected-state";
const VERIFIER = "the-verifier";

function callback(
  query: Record<string, string>,
  cookies: Record<string, string> = { [STATE_COOKIE]: STATE, [VERIFIER_COOKIE]: VERIFIER },
) {
  const url = new URL(`${persona.appUrl}/callback`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

  return new NextRequest(url, { headers: cookie ? { cookie } : {} });
}

const errorFrom = (location: string) => new URL(location).searchParams.get("error");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refusing a callback", () => {
  it.each([
    ["no code", { state: STATE }, undefined],
    ["no state", { code: "the-code" }, undefined],
    ["a state that does not match the cookie", { code: "the-code", state: "someone-elses" }, undefined],
    [
      "a state of the wrong length",
      { code: "the-code", state: `${STATE}-longer` },
      undefined,
    ],
    ["no state cookie", { code: "the-code", state: STATE }, { [VERIFIER_COOKIE]: VERIFIER }],
    ["no verifier cookie", { code: "the-code", state: STATE }, { [STATE_COOKIE]: STATE }],
    ["no cookies at all", { code: "the-code", state: STATE }, {}],
  ])("sends the person home with an error when there is %s", async (_label, query, cookies) => {
    const res = await GET(callback(query, cookies));

    expect(res.status).toBe(307);
    expect(errorFrom(res.headers.get("location") as string)).toBe("invalid_callback");
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  // Persona sends the person back with ?error when they decline. That is a
  // normal outcome, not an attack, and it keeps its own reason.
  it("passes through the reason when the person declined", async () => {
    const res = await GET(callback({ error: "access_denied" }));

    expect(errorFrom(res.headers.get("location") as string)).toBe("access_denied");
  });

  it("reports a failed token exchange separately", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));

    const res = await GET(callback({ code: "the-code", state: STATE }));

    expect(errorFrom(res.headers.get("location") as string)).toBe("token_exchange_failed");
  });
});

describe("accepting a callback", () => {
  it("exchanges the code and starts a session", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "an-access-token" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(callback({ code: "the-code", state: STATE }));

    expect(res.headers.get("location")).toBe(`${persona.appUrl}/home`);

    const session = res.cookies.get(SESSION_COOKIE);
    expect(session?.value).toBe("an-access-token");
    // The token must never be readable from JavaScript.
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("lax");

    // The one-time values are spent, so a replay of the same callback fails.
    expect(res.cookies.get(STATE_COOKIE)?.value).toBe("");
    expect(res.cookies.get(VERIFIER_COOKIE)?.value).toBe("");
  });

  it("sends the verifier, not the challenge, to the token endpoint", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "an-access-token" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await GET(callback({ code: "the-code", state: STATE }));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);

    expect(url).toBe(`${persona.internalUrl}/oidc/token`);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("the-code");
    expect(body.get("code_verifier")).toBe(VERIFIER);
    // Authenticated with HTTP Basic, as the client is registered.
    expect((init.headers as Record<string, string>).authorization).toMatch(/^Basic /);
  });

  it("treats a token response with no access_token as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));

    const res = await GET(callback({ code: "the-code", state: STATE }));

    expect(errorFrom(res.headers.get("location") as string)).toBe("token_exchange_failed");
  });
});
