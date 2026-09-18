import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { persona, SESSION_COOKIE } from "@/lib/persona";

// Where /home sends the person once Persona stops answering for their token,
// usually because they revoked access in Persona. Without it the stale cookie
// bounced them between the landing page and /home forever.
function arrive(cookies: Record<string, string> = { [SESSION_COOKIE]: "an-access-token" }) {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

  return new NextRequest(`${persona.appUrl}/access-ended`, { headers: cookie ? { cookie } : {} });
}

function personaAnswers(ok: boolean) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 401,
    json: async () => ({ sub: "someone" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("arriving after access has ended", () => {
  it("clears a session Persona no longer honours and says why", async () => {
    personaAnswers(false);

    const res = await GET(arrive());

    expect(res.headers.get("location")).toBe(`${persona.appUrl}/?error=access_ended`);
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe("");
  });

  // Reachable by any link, so it must not end a session that still works.
  it("sends a working session back home untouched", async () => {
    personaAnswers(true);

    const res = await GET(arrive());

    expect(res.headers.get("location")).toBe(`${persona.appUrl}/home`);
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("sends someone with no session to the landing page without asking Persona", async () => {
    const fetchMock = personaAnswers(true);

    const res = await GET(arrive({}));

    expect(res.headers.get("location")).toBe(`${persona.appUrl}/`);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
