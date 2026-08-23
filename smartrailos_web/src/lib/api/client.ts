export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
// All backend endpoints live under /api/v1 (FastAPI router prefix).
export const API_V1_PREFIX = "/api/v1";
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (USE_MOCK) {
    throw new Error("apiFetch called without VITE_API_BASE_URL set");
  }
  const normalized = path.startsWith("/api/") ? path : `${API_V1_PREFIX}${path}`;
  const url = `${API_BASE_URL.replace(/\/$/, "")}${normalized}`;
  
  const token = typeof window !== "undefined" ? localStorage.getItem("smartrail_auth_token") : null;
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {}
    throw new ApiError(res.status, body, `API ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function mockAsync<T>(value: T, delayMs = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), delayMs));
}
