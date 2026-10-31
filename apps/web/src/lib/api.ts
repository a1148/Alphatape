function withPageHostname(configured: string | undefined, fallbackPort: string, protocol: "http:" | "https:" | "ws:" | "wss:"): string {
  if (typeof window === "undefined") return configured ?? `${protocol}//127.0.0.1:${fallbackPort}`;
  try {
    const url = new URL(configured ?? `${protocol}//127.0.0.1:${fallbackPort}`);
    url.hostname = window.location.hostname;
    url.protocol = protocol;
    return url.origin;
  } catch {
    return `${protocol}//${window.location.hostname}:${fallbackPort}`;
  }
}

/** Matches the page host so a tab on 127.0.0.1 does not call localhost (a different CORS origin). */
export function apiUrl(): string {
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
  return withPageHostname(process.env.NEXT_PUBLIC_API_URL, "3848", protocol);
}

export function wsUrl(): string {
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const origin = withPageHostname(process.env.NEXT_PUBLIC_WS_URL, "3848", protocol);
  return `${origin}/ws`;
}

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`HTTP ${status}`);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const res = await fetch(`${apiUrl()}${path}`, {
    ...init,
    signal: init?.signal ?? controller.signal,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  }).finally(() => clearTimeout(timer));
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
