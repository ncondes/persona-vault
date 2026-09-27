import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

// Persona fetches this path and compares the body to the token it issued in the
// console. So the body has to be the token and nothing else: a wrapper, a
// rendered page, or an error served with status 200 would all read as a pass and
// hand the app a badge it has not earned.
describe("the domain verification challenge", () => {
  it("serves the token as plain text when one is configured", async () => {
    vi.stubEnv("PERSONA_VERIFICATION_TOKEN", "a-token-from-the-console");

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("a-token-from-the-console");
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  it("refuses with a 404 when no token is configured", async () => {
    vi.stubEnv("PERSONA_VERIFICATION_TOKEN", undefined);

    const res = await GET();

    expect(res.status).toBe(404);
    // Not the token, and not an empty 200 either: an app that has never been
    // given a token must not look like one that holds the wrong one.
    expect(await res.text()).toBe("not configured");
  });
});
