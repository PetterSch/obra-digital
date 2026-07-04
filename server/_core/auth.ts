// auth.ts — autenticação própria com JWT (sem Manus)
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import * as db from "../db";
import { COOKIE_NAME, SESSION_MS } from "../../shared/const";
import type { User } from "../../drizzle/schema";

// Segredo do JWT. Em produção NUNCA usa o valor padrão do repositório (público):
// sem JWT_SECRET definido, gera um segredo aleatório no boot — o sistema continua
// funcionando, mas as sessões caem a cada restart até a variável ser configurada.
import { randomBytes } from "crypto";
const DEV_SECRET = "obra-digital-secret-key-mude-em-producao";
let _bootSecret: string | null = null;
function resolveSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV !== "production") return DEV_SECRET;
  if (!_bootSecret) {
    _bootSecret = randomBytes(32).toString("hex");
    console.error("[AUTH] AVISO: JWT_SECRET não definido em produção. Usando segredo aleatório temporário — as sessões expiram a cada restart. Defina JWT_SECRET no .env do servidor.");
  }
  return _bootSecret;
}
const getSecret = () => new TextEncoder().encode(resolveSecret());

export async function createSessionToken(userId: number, role: string, name: string): Promise<string> {
  return new SignJWT({ userId, role, name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor((Date.now() + SESSION_MS) / 1000))
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<{ userId: number; role: string; name: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const { userId, role, name } = payload as Record<string, unknown>;
    if (typeof userId !== "number" || typeof role !== "string" || typeof name !== "string") return null;
    return { userId, role, name };
  } catch {
    return null;
  }
}

export async function authenticateRequest(req: Request): Promise<User | null> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return db.getUserById(session.userId);
}
