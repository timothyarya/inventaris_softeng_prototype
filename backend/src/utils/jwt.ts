import jwt, { type SignOptions } from "jsonwebtoken";
import type { CookieOptions } from "express";
import { env } from "../config/env";
import { unauthorized } from "./errors";

export const AUTH_COOKIE = "token";

export function signToken(userId: number): string {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: String(userId),
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

/** Mengembalikan id user dari token, atau melempar 401 bila token tidak valid/kedaluwarsa. */
export function verifyToken(token: string): number {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    const id = Number(typeof payload === "string" ? NaN : payload.sub);
    if (!Number.isInteger(id)) throw new Error("sub tidak valid");
    return id;
  } catch {
    throw unauthorized();
  }
}

/** Opsi cookie JWT: httpOnly, same-site, secure hanya di production. */
export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

/** Sisa umur token dalam milidetik, dipakai untuk `maxAge` cookie. */
export function tokenMaxAgeMs(token: string): number | undefined {
  const decoded = jwt.decode(token);
  if (decoded && typeof decoded === "object" && typeof decoded.exp === "number") {
    return Math.max(decoded.exp * 1000 - Date.now(), 0);
  }
  return undefined;
}
