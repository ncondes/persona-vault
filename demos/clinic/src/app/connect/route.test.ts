import { describe, expect, it } from "vitest";
import { GET } from "./route";
import {
  challengeFor,
  persona,
  redirectUri,
  SCOPE,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/persona";

// Starting the flow. Everything the callback will later check has to be planted
// here, or the connection can never complete.
describe("Connect with Persona", () => {
  it("sends the browser to Persona's authorize endpoint", async () => {
    const res = await GET();
    const url = new URL(res.headers.get("location") as string);

    expect(`${url.origin}${url.pathname}`).toBe(`${persona.publicUrl}/oidc/auth`);
    expect(url.searchParams.get("client_id")).toBe(persona.clientId);
    expect(url.searchParams.get("scope")).toBe(SCOPE);
    expect(url.searchParams.get("redirect_uri")).toBe(redirectUri());
  });

  it("parks the state and verifier where only the server can read them", async () => {
    const res = await GET();

    for (const name of [STATE_COOKIE, VERIFIER_COOKIE]) {
      const cookie = res.cookies.get(name);
      expect(cookie?.value).toBeTruthy();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe("lax");
      // Short-lived: this is a request in progress, not a session.
      expect(cookie?.maxAge).toBe(600);
    }
  });

  // The verifier stays in the cookie; only its hash goes to Persona. That is the
  // whole point of PKCE — an intercepted authorization code is useless without
  // the verifier, which never crossed the network.
  it("sends the challenge and keeps the verifier", async () => {
    const res = await GET();
    const url = new URL(res.headers.get("location") as string);
    const verifier = res.cookies.get(VERIFIER_COOKIE)?.value as string;

    expect(url.searchParams.get("code_challenge")).toBe(challengeFor(verifier));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(res.headers.get("location")).not.toContain(verifier);
  });

  it("puts the same state in the cookie as in the URL", async () => {
    const res = await GET();
    const url = new URL(res.headers.get("location") as string);

    expect(url.searchParams.get("state")).toBe(res.cookies.get(STATE_COOKIE)?.value);
  });

  it("starts a fresh flow every time", async () => {
    const [first, second] = [await GET(), await GET()];

    expect(first.cookies.get(STATE_COOKIE)?.value).not.toBe(second.cookies.get(STATE_COOKIE)?.value);
    expect(first.cookies.get(VERIFIER_COOKIE)?.value).not.toBe(
      second.cookies.get(VERIFIER_COOKIE)?.value,
    );
  });
});
