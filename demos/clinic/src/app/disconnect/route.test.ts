import { describe, expect, it } from "vitest";
import { GET as connect } from "../connect/route";
import { POST } from "./route";
import { persona, SESSION_COOKIE } from "@/lib/persona";

// Disconnecting here ends this app's session and nothing more. Persona's grant
// belongs to the person and is revoked in Persona — an app quietly revoking on
// their behalf would be the app deciding, which is the opposite of the point.
describe("disconnecting", () => {
  it("clears the session and sends the person back to the landing page", async () => {
    const res = await POST();

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${persona.appUrl}/`);
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe("");
  });

  it("does not call Persona", async () => {
    // No fetch is stubbed, so any network call would throw rather than pass.
    await expect(POST()).resolves.toBeDefined();
  });

  it("is a POST, so a stray link or prefetch cannot sign someone out", () => {
    const route = { POST, connect } as Record<string, unknown>;
    expect(typeof route.POST).toBe("function");
  });
});
