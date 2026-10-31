import { Redis } from "ioredis";
import { logger } from "./logger";

function createRedis(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    logger.warn("REDIS_URL is not set; cache and cross-process live tape are disabled");
    return null;
  }
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2500,
    retryStrategy(times) {
      if (times > 8) return null;
      return Math.min(times * 300, 3000);
    },
  });
  client.on("error", (error) => logger.warn({ err: error.message }, "redis unavailable"));
  client.connect().catch((error) => logger.warn({ err: error instanceof Error ? error.message : "redis" }, "redis connect failed"));
  return client;
}

export const redis = createRedis();

export async function cachedJson<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  if (redis?.status === "ready") {
    try {
      const hit = await redis.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch (error) {
      logger.warn({ err: error instanceof Error ? error.message : "cache", key }, "cache read failed");
    }
  }
  const value = await load();
  if (redis?.status === "ready") {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      logger.warn({ err: error instanceof Error ? error.message : "cache", key }, "cache write failed");
    }
  }
  return value;
}
