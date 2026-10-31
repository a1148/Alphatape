import { Redis } from "ioredis";
import { logger } from "./logger";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:63799/0", {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
});

redis.on("error", (error) => logger.warn({ err: error.message }, "redis error"));

export async function cachedJson<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : "cache", key }, "cache read failed");
  }
  const value = await load();
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : "cache", key }, "cache write failed");
  }
  return value;
}
