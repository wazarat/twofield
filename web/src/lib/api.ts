"use client";

import { getAccessToken } from "@privy-io/react-auth";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: Record<string, string>,
  ) {
    super(message);
  }
}

// Calls our own API with the Privy access token attached.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(path, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; details?: Record<string, string> };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed with ${res.status}`, res.status, data.details);
  return data;
}
