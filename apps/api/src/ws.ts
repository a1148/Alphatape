import type { Server } from "node:http";
import { jwtVerify } from "jose";
import { WebSocketServer, type WebSocket } from "ws";
import { logger } from "./logger";
import { wsClients } from "./metrics";
import { redis } from "./redis";

const COOKIE = "alphatape_token";

function readCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === COOKIE) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

async function userIdFromToken(token: string | null): Promise<string | null> {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-only-change-me-please-32chars");
    const { payload } = await jwtVerify(token, secret);
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function attachWebsocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const users = new WeakMap<WebSocket, string | null>();

  wss.on("connection", async (socket, request) => {
    users.set(socket, await userIdFromToken(readCookie(request.headers.cookie)));
    wsClients.set(wss.clients.size);
    socket.send(JSON.stringify({ type: "hello", demo: process.env.DATA_MODE !== "live" }));
    socket.on("message", async (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string; token?: string };
        if (msg.type === "auth" && msg.token) users.set(socket, await userIdFromToken(msg.token));
      } catch {
        socket.send(JSON.stringify({ type: "error", error: "bad_message" }));
      }
    });
    socket.on("close", () => wsClients.set(wss.clients.size));
  });

  const sub = redis.duplicate();
  sub.subscribe("tape").catch((error) => logger.error({ err: error }, "ws subscribe failed"));
  sub.on("message", (_channel, message) => {
    let parsed: { type?: string; userId?: string } | null = null;
    try {
      parsed = JSON.parse(message) as { type?: string; userId?: string };
    } catch {
      return;
    }
    for (const client of wss.clients) {
      if (client.readyState !== client.OPEN) continue;
      if (parsed?.type === "alert" && parsed.userId && users.get(client) !== parsed.userId) continue;
      client.send(message);
    }
  });

  const ping = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.ping();
    }
  }, 20_000);
  wss.on("close", () => clearInterval(ping));
  return wss;
}
