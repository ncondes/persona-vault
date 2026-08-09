import type {
  ActivityView,
  AppPatch,
  AppView,
  AppWithSecret,
  Catalog,
  Connection,
  Decision,
  Interaction,
  NewApp,
  NewVaultItem,
  OtpChallenge,
  PreviewResult,
  Settings,
  User,
  VaultItem,
} from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  // The /api routes wrap responses in { data }; interaction routes do not.
  raw?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && path.startsWith("/api/") && !path.startsWith("/api/auth/")) {
    window.location.assign("/login");
  }

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = payload?.error ?? {};
    throw new ApiError(res.status, error.code ?? "UNKNOWN", error.message ?? "Request failed", error.fields);
  }
  return (options.raw ? payload : payload.data) as T;
}

// Auth. Both flows are two calls: the first sends a code to the address, the
// second is where the account (or the session) actually appears.
export const register = (firstName: string, lastName: string, email: string, password: string) =>
  request<OtpChallenge>("/api/auth/register", {
    method: "POST",
    body: { firstName, lastName, email, password },
  });
export const verifySignup = (challengeId: string, code: string) =>
  request<User>("/api/auth/register/verify", { method: "POST", body: { challengeId, code } });
export const login = (email: string, password: string) =>
  request<OtpChallenge>("/api/auth/login", { method: "POST", body: { email, password } });
export const verifyLogin = (challengeId: string, code: string) =>
  request<User>("/api/auth/login/verify", { method: "POST", body: { challengeId, code } });
export const resendCode = (challengeId: string) =>
  request<OtpChallenge>("/api/auth/otp/resend", { method: "POST", body: { challengeId } });
export const logout = () => request<void>("/api/auth/logout", { method: "POST" });
export const getMe = () => request<User>("/api/auth/me");

// Vault
export const getVault = () => request<{ items: VaultItem[] }>("/api/vault");
export const getCatalog = () => request<Catalog>("/api/catalog");
export const createItem = (item: NewVaultItem) =>
  request<VaultItem>("/api/vault/items", { method: "POST", body: item });
export const updateItem = (id: string, patch: Partial<NewVaultItem>) =>
  request<VaultItem>(`/api/vault/items/${id}`, { method: "PUT", body: patch });
export const deleteItem = (id: string) =>
  request<void>(`/api/vault/items/${id}`, { method: "DELETE" });

// Account
export const getConnections = () => request<Connection[]>("/api/connections");
export const revokeConnection = (clientId: string) =>
  request<void>(`/api/connections/${clientId}`, { method: "DELETE" });
export const getSettings = () => request<Settings>("/api/settings");
export const updateSettings = (patch: Partial<Settings>) =>
  request<Settings>("/api/settings", { method: "PUT", body: patch });
export const deleteAccount = () => request<void>("/api/account", { method: "DELETE" });

// Developer console
export const getApps = () => request<AppView[]>("/api/apps");
export const getApp = (id: string) => request<AppView>(`/api/apps/${id}`);
export const createApp = (app: NewApp) =>
  request<AppWithSecret>("/api/apps", { method: "POST", body: app });
export const updateApp = (id: string, patch: AppPatch) =>
  request<AppView>(`/api/apps/${id}`, { method: "PUT", body: patch });
export const deleteApp = (id: string) => request<void>(`/api/apps/${id}`, { method: "DELETE" });
export const rotateAppSecret = (id: string) =>
  request<AppWithSecret>(`/api/apps/${id}/secret`, { method: "POST" });
export const previewPayload = (purpose: string, scopes: string[]) =>
  request<PreviewResult>("/api/apps/preview", { method: "POST", body: { purpose, scopes } });
export const getAppActivity = (id: string) => request<ActivityView>(`/api/apps/${id}/activity`);

// OIDC interaction (consent app)
export const getInteraction = (uid: string) =>
  request<Interaction>(`/interaction/${uid}`, { raw: true });
export const interactionLogin = (uid: string, email: string, password: string) =>
  request<OtpChallenge>(`/interaction/${uid}/login`, {
    method: "POST",
    body: { email, password },
    raw: true,
  });
export const interactionVerify = (uid: string, challengeId: string, code: string) =>
  request<{ redirectTo: string }>(`/interaction/${uid}/verify`, {
    method: "POST",
    body: { challengeId, code },
    raw: true,
  });
export const interactionDecision = (uid: string, decision: Decision) =>
  request<{ redirectTo: string }>(`/interaction/${uid}/decision`, {
    method: "POST",
    body: decision,
    raw: true,
  });
export const interactionAbort = (uid: string) =>
  request<{ redirectTo: string }>(`/interaction/${uid}/abort`, { method: "POST", raw: true });
