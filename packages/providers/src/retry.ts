import { ProviderHttpError } from "./types";

export function isRetryable(error: unknown): boolean {
  if (error instanceof ProviderHttpError) return error.retryable;
  if (error instanceof Error && error.message.startsWith("circuit_open:")) return false;
  return false;
}

export async function withRetry<T>(fn: () => Promise<T>, opts?: { retries?: number; baseMs?: number }): Promise<T> {
  const retries = opts?.retries ?? 3;
  const base = opts?.baseMs ?? 200;
  let last: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isRetryable(error) || attempt === retries - 1) throw error;
      const delay = base * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw last;
}
