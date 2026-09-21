import { describe, expect, it } from "vitest";
import { integrationSnippets } from "./snippets";
import { getStrings } from "./strings";
import type { AppView } from "./types";

const t = getStrings("en");
const ISSUER = "http://localhost:4400/oidc";

const app: AppView = {
  id: "city-health-clinic-a3f91c",
  name: "City Health Clinic",
  description: null,
  purpose: "healthcare",
  accent: "teal",
  allowedScopes: ["name", "email", "blood_type"],
  requiredScopes: ["name"],
  redirectUris: ["http://localhost:4411/callback"],
  secretLastFour: "3f9a",
  status: "active",
  verifiedDomain: null,
  verifiedAt: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const snippetsFor = (overrides: Partial<AppView> = {}) =>
  Object.fromEntries(
    integrationSnippets({ ...app, ...overrides }, ISSUER, t).map((s) => [s.id, s.code]),
  );

describe("integrationSnippets", () => {
  it("covers the three steps a relying party has to implement", () => {
    expect(Object.keys(snippetsFor())).toEqual(["authorize", "token", "userinfo"]);
  });

  it("labels and annotates every step", () => {
    for (const snippet of integrationSnippets(app, ISSUER, t)) {
      expect(snippet.label).toBeTruthy();
      expect(snippet.note).toBeTruthy();
    }
  });

  it("puts openid first and then the app's own scopes", () => {
    expect(snippetsFor().authorize).toContain('scope: "openid name email blood_type"');
  });

  // Copy-pasteability is the point of the panel. A hand-written URL with a raw
  // space in `scope` is the classic first-hour mistake, so the snippet builds
  // the query with URLSearchParams and never interpolates one itself.
  it("builds the query with URLSearchParams rather than a hand-written URL", () => {
    const authorize = snippetsFor().authorize;

    expect(authorize).toContain("new URLSearchParams({");
    expect(authorize).toContain("${params}");
    expect(authorize).not.toMatch(/scope=openid[ +]/);
  });

  it("uses the real endpoints from the discovery document", () => {
    const code = snippetsFor();
    expect(code.authorize).toContain(`${ISSUER}/auth`);
    expect(code.token).toContain(`${ISSUER}/token`);
    expect(code.userinfo).toContain(`${ISSUER}/me`);

    // Not /authorize and /userinfo, which is what most OIDC examples show.
    expect(code.authorize).not.toContain("/authorize?");
    expect(code.userinfo).not.toContain("/userinfo");
  });

  it("shows PKCE, because every demo app uses it", () => {
    const authorize = snippetsFor().authorize;
    expect(authorize).toContain("code_challenge");
    expect(authorize).toContain('code_challenge_method: "S256"');
    expect(snippetsFor().token).toContain("code_verifier");
  });

  it("authenticates the token call with HTTP Basic, as the clients are registered", () => {
    const token = snippetsFor().token;
    expect(token).toContain("Basic");
    expect(token).toContain('grant_type: "authorization_code"');
    // The secret must never end up in a snippet the console renders.
    expect(token).not.toContain(app.secretLastFour);
  });

  it("quotes the app's own id and redirect URI", () => {
    const code = snippetsFor();
    expect(code.authorize).toContain(JSON.stringify(app.id));
    expect(code.authorize).toContain(JSON.stringify(app.redirectUris[0]));
    expect(code.token).toContain(JSON.stringify(app.redirectUris[0]));
  });

  // An app is created with at least one redirect URI, but the scopes tab renders
  // a draft before one is saved.
  it("falls back to a placeholder when there is no redirect URI yet", () => {
    expect(snippetsFor({ redirectUris: [] }).authorize).toContain(
      '"https://example.com/callback"',
    );
  });

  it("escapes a value that would otherwise break the snippet", () => {
    const code = snippetsFor({ id: 'quote"and\\backslash' });
    expect(code.authorize).toContain('"quote\\"and\\\\backslash"');
  });

  it("asks for openid alone when the app requests no data", () => {
    expect(snippetsFor({ allowedScopes: [] }).authorize).toContain('scope: "openid"');
  });
});
