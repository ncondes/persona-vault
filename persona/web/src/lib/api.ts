import type {
  Catalog,
  Connection,
  Decision,
  Interaction,
  NewVaultItem,
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

// Auth
export const register = (fullName: string, email: string, password: string) =>
  request<User>("/api/auth/register", { method: "POST", body: { fullName, email, password } });
export const login = (email: string, password: string) =>
  request<User>("/api/auth/login", { method: "POST", body: { email, password } });
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

// OIDC interaction (consent app)
export const getInteraction = (uid: string) =>
  request<Interaction>(`/interaction/${uid}`, { raw: true });
export const interactionLogin = (uid: string, email: string, password: string) =>
  request<{ redirectTo: string }>(`/interaction/${uid}/login`, {
    method: "POST",
    body: { email, password },
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
