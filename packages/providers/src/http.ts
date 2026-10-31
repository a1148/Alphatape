import { ProviderHttpError } from "./types";

export function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const cleaned = value.replace(/%/g, "").replace(/,/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function fetchJson(url: string, init: { timeoutMs?: number; headers?: Record<string, string> } = {}): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 12_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: init.headers });
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text.slice(0, 400) };
      }
    }
    if (res.status === 429 || res.status >= 500) {
      throw new ProviderHttpError(`HTTP ${res.status}`, res.status, true);
    }
    if (!res.ok) throw new ProviderHttpError(`HTTP ${res.status}`, res.status, false);
    return body;
  } catch (error) {
    if (error instanceof ProviderHttpError) throw error;
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : "fetch failed";
    if (name === "AbortError") throw new ProviderHttpError("timeout", 0, true);
    throw new ProviderHttpError(message, 0, true);
  } finally {
    clearTimeout(timer);
  }
}
