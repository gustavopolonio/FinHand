import { apiUrl } from "./config";

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string | null;
  imageUrl: string | null;
  defaultCurrency: string;
  timeZone: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(response.status, body?.error ?? "Request failed.");
  }

  return (await response.json()) as T;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getCurrentUser() {
  return request<CurrentUser>("/api/me");
}
