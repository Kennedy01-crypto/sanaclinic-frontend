export type ApiFailure = Error & { status?: number };

export type PortalUser = {
  id: number;
  username: string;
  role: "patient" | "admin";
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  emergency_contact: string;
};

const API_BASE = "/backend-api";
const DJANGO_BASE = (
  process.env.NEXT_PUBLIC_DJANGO_URL ?? API_BASE.replace(/\/api$/, "")
).replace(/\/$/, "");

export function djangoAdminUrl(path: string) {
  return `${DJANGO_BASE}/${path.replace(/^\/+/, "")}`;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const response = await fetch(`${API_BASE}/${path.replace(/^\/+/, "")}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401 && allowRefresh && !path.includes("accounts/refresh/")) {
    const refreshed = await fetch(`${API_BASE}/accounts/refresh/`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshed.ok) return apiRequest<T>(path, init, false);
  }

  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(getErrorMessage(payload)) as ApiFailure;
    failure.status = response.status;
    throw failure;
  }
  return payload as T;
}

export function getErrorMessage(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    const entries = Object.values(payload as Record<string, unknown>);
    for (const entry of entries) {
      if (typeof entry === "string") return entry;
      if (Array.isArray(entry) && typeof entry[0] === "string") return entry[0];
    }
  }
  return "We could not complete your request. Please check your details and try again.";
}
