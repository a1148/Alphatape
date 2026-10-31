import { prisma } from "@alphatape/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { normalizeWeights, type Weights } from "@alphatape/shared";

const COOKIE = "alphatape_token";

function secret() {
  const value = process.env.JWT_SECRET ?? "dev-only-change-me-please-32chars";
  return new TextEncoder().encode(value);
}

export async function signToken(user: { id: string; email: string }) {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export function setAuthCookie(reply: FastifyReply, token: string) {
  reply.setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
}

export function clearAuthCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE, { path: "/" });
}

export async function readUser(request: FastifyRequest) {
  const header = request.headers.authorization;
  const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  const token = bearer || request.cookies[COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return prisma.user.findUnique({ where: { id: payload.sub }, include: { settings: true } });
  } catch {
    return null;
  }
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await readUser(request);
  if (!user) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return user;
}

export async function weightsFor(request: FastifyRequest): Promise<Weights> {
  const user = await readUser(request);
  const stored = user?.settings?.weights;
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    return normalizeWeights(stored as Partial<Weights>);
  }
  return normalizeWeights();
}
