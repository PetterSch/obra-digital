// auth.ts — autenticação própria com JWT (sem Manus)
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import * as db from "../db";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import type { User } from "../../drizzle/schema";

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET || "obra-digital-secret-key-mude-em-producao");

export async function createSessionToken(userId: number, role: string, name: string): Promise<string> {
  return new SignJWT({ userId, role, name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
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
