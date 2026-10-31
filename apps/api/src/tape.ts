import { logger } from "./logger";
import { redis } from "./redis";

type TapeHandler = (message: string) => void;

const localHandlers = new Set<TapeHandler>();

export function onLocalTape(handler: TapeHandler) {
  localHandlers.add(handler);
  return () => {
    localHandlers.delete(handler);
  };
}

export function emitLocalTape(message: string) {
  for (const handler of localHandlers) {
    try {
      handler(message);
    } catch (error) {
      logger.warn({ err: error instanceof Error ? error.message : "tape" }, "tape handler failed");
    }
  }
}

/** Publish a live tape message. Uses Redis when it is connected; otherwise stays in-process. */
export async function publishTape(message: unknown) {
  const raw = JSON.stringify(message);
  const embedded = process.env.EMBED_WORKER === "1";
  if (embedded) {
    emitLocalTape(raw);
    if (redis?.status === "ready") {
      redis.publish("tape", raw).catch((error) => {
        logger.warn({ err: error instanceof Error ? error.message : "redis" }, "redis publish failed");
      });
    }
    return;
  }
  if (redis?.status === "ready") {
    try {
      await redis.publish("tape", raw);
      return;
    } catch (error) {
      logger.warn({ err: error instanceof Error ? error.message : "redis" }, "redis publish failed; using in-process tape");
    }
  }
  emitLocalTape(raw);
}
