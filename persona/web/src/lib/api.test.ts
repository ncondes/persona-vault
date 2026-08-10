import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";
import {
  ApiError,
  createItem,
  deleteItem,
  getMe,
  interactionDecision,
  login,
  previewPayload,
} from "./api";

// The shared request helper, driven through the real endpoint wrappers. A stubbed
// `fetch` is all it needs — no DOM, no server.
interface StubResponse {
  status?: number;
  body?: unknown;
  ok?: boolean;
}

let calls: Array<{ path: string; init: RequestInit }>;
let assigned: string[];

// Narrows the rejection so the assertions can read ApiError's own fields.
async function rejection(run: Promise<unknown>): Promise<ApiError> {
  try {
    await run;
  } catch (err) {
    return err as ApiError;
  }
  throw new Error("expected the request to reject");
}

function stubFetch(...responses: StubResponse[]) {
  const queue = [...responses];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init: RequestInit) => {
      calls.push({ path, init });
      const next = queue.shift() ?? {};
      const status = next.status ?? 200;
      return {
        status,
        ok: next.ok ?? (status >= 200 && status < 300),
        json: async () => {
          if (next.body === undefined) throw new SyntaxError("no body");
          return next.body;
        },
      };
    }),
  );
}

beforeEach(() => {
  calls = [];
  assigned = [];
  vi.stubGlobal("window", { location: { assign: (url: string) => assigned.push(url) } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sending a request", () => {
  it("unwraps the { data } envelope the API routes use", async () => {
    stubFetch({ body: { data: { id: "1", email: "a@example.com" } } });

    await expect(getMe()).resolves.toEqual({ id: "1", email: "a@example.com" });
  });

  // The interaction routes answer with a bare object, not an envelope.
  it("returns the whole body for a raw request", async () => {
    stubFetch({ body: { redirectTo: "http://localhost:4400/oidc/auth/resume" } });

    await expect(interactionDecision("uid-1", {})).resolves.toEqual({
      redirectTo: "http://localhost:4400/oidc/auth/resume",
    });
  });

  it("treats 204 as nothing rather than trying to parse it", async () => {
    stubFetch({ status: 204 });

    await expect(deleteItem("item-1")).resolves.toBeUndefined();
  });

  it("sends cookies and asks for JSON on every call", async () => {
    stubFetch({ body: { data: {} } });
    await getMe();

    expect(calls[0].init.credentials).toBe("include");
    expect((calls[0].init.headers as Record<string, string>).Accept).toBe("application/json");
  });

  it("adds a Content-Type only when there is a body to describe", async () => {
    stubFetch({ body: { data: {} } }, { body: { data: {} } });

    await getMe();
    expect((calls[0].init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    expect(calls[0].init.body).toBeUndefined();

    await createItem({ kind: "email", value: "a@example.com" });
    expect((calls[1].init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(calls[1].init.body as string)).toEqual({
      kind: "email",
      value: "a@example.com",
    });
  });
});

describe("errors", () => {
  it("raises an ApiError carrying the server's code and field errors", async () => {
    stubFetch({
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          fields: { value: "INVALID_EMAIL" },
        },
      },
    });

    const err = await rejection(createItem({ kind: "email", value: "nope" }));

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.fields).toEqual({ value: "INVALID_EMAIL" });
  });

  // A gateway or proxy can fail with no JSON at all; the UI still needs
  // something to show.
  it("falls back to a generic error when the body is not JSON", async () => {
    stubFetch({ status: 502 });

    const err = await rejection(getMe());

    expect(err.code).toBe("UNKNOWN");
    expect(err.message).toBe("Request failed");
  });
});

describe("an expired session", () => {
  it("sends the person to the login page when an API call comes back 401", async () => {
    stubFetch({ status: 401, body: { error: { code: "UNAUTHORIZED" } } });

    await previewPayload("retail", ["email"]).catch(() => undefined);

    expect(assigned).toEqual(["/login"]);
  });

  // Signing in with the wrong password is a 401 too. Redirecting there would
  // reload the login page and throw away the error message.
  it("does not redirect when the 401 came from signing in", async () => {
    stubFetch({ status: 401, body: { error: { code: "INVALID_CREDENTIALS" } } });

    await login("a@example.com", "wrong").catch(() => undefined);

    expect(assigned).toEqual([]);
  });

  it("does not redirect on a 401 from outside /api", async () => {
    stubFetch({ status: 401, body: { error: { code: "INTERACTION_EXPIRED" } } });

    await interactionDecision("uid-1", {}).catch(() => undefined);

    expect(assigned).toEqual([]);
  });
});

// Each wrapper is one line, but that line is the URL and verb the whole app
// depends on. A typo here is a 404 at runtime and nothing catches it earlier, so
// the endpoint map is pinned as a table.
describe("the endpoint map", () => {
  const ID = "app-1";

  it.each([
    ["register", () => api.register("A", "B", "a@x.co", "password123"), "POST", "/api/auth/register"],
    ["verifySignup", () => api.verifySignup("c1", "123456"), "POST", "/api/auth/register/verify"],
    ["login", () => api.login("a@x.co", "p"), "POST", "/api/auth/login"],
    ["verifyLogin", () => api.verifyLogin("c1", "123456"), "POST", "/api/auth/login/verify"],
    ["resendCode", () => api.resendCode("c1"), "POST", "/api/auth/otp/resend"],
    ["logout", () => api.logout(), "POST", "/api/auth/logout"],
    ["getMe", () => api.getMe(), "GET", "/api/auth/me"],

    ["getVault", () => api.getVault(), "GET", "/api/vault"],
    ["getCatalog", () => api.getCatalog(), "GET", "/api/catalog"],
    ["createItem", () => api.createItem({ kind: "email", value: "a@x.co" }), "POST", "/api/vault/items"],
    ["updateItem", () => api.updateItem("i1", { value: "b@x.co" }), "PUT", "/api/vault/items/i1"],
    ["deleteItem", () => api.deleteItem("i1"), "DELETE", "/api/vault/items/i1"],

    ["getConnections", () => api.getConnections(), "GET", "/api/connections"],
    ["revokeConnection", () => api.revokeConnection("clinic"), "DELETE", "/api/connections/clinic"],
    ["getSettings", () => api.getSettings(), "GET", "/api/settings"],
    ["updateSettings", () => api.updateSettings({ notifyAccess: true }), "PUT", "/api/settings"],
    ["deleteAccount", () => api.deleteAccount(), "DELETE", "/api/account"],

    ["getApps", () => api.getApps(), "GET", "/api/apps"],
    ["getApp", () => api.getApp(ID), "GET", `/api/apps/${ID}`],
    ["createApp", () => api.createApp({ name: "A" } as never), "POST", "/api/apps"],
    ["updateApp", () => api.updateApp(ID, { name: "B" }), "PUT", `/api/apps/${ID}`],
    ["deleteApp", () => api.deleteApp(ID), "DELETE", `/api/apps/${ID}`],
    ["rotateAppSecret", () => api.rotateAppSecret(ID), "POST", `/api/apps/${ID}/secret`],
    ["previewPayload", () => api.previewPayload("retail", ["email"]), "POST", "/api/apps/preview"],
    ["getAppActivity", () => api.getAppActivity(ID), "GET", `/api/apps/${ID}/activity`],

    ["getInteraction", () => api.getInteraction("uid"), "GET", "/interaction/uid"],
    ["interactionLogin", () => api.interactionLogin("uid", "a@x.co", "p"), "POST", "/interaction/uid/login"],
    ["interactionVerify", () => api.interactionVerify("uid", "c1", "123456"), "POST", "/interaction/uid/verify"],
    ["interactionDecision", () => api.interactionDecision("uid", {}), "POST", "/interaction/uid/decision"],
    ["interactionAbort", () => api.interactionAbort("uid"), "POST", "/interaction/uid/abort"],
  ])("%s does %s %s", async (_name, call, method, path) => {
    stubFetch({ body: { data: {} } });

    await call();

    expect(calls[0].path).toBe(path);
    expect(calls[0].init.method).toBe(method);
  });

  it("covers every function this module exports", () => {
    const exported = Object.entries(api)
      .filter(([, value]) => typeof value === "function" && value !== ApiError)
      .map(([name]) => name);

    // Keep this in step with the table above; a new endpoint should be pinned too.
    expect(exported).toHaveLength(30);
  });
});
