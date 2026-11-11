import type { RequestHandler } from "express";
import { AUTH_COOKIE, authCookieOptions, tokenMaxAgeMs } from "../../utils/jwt";
import { unauthorized } from "../../utils/errors";
import * as authService from "./service";
import type { LoginInput } from "./schema";

export const login: RequestHandler = async (req, res) => {
  const { token, user } = await authService.login(req.body as LoginInput);
  res.cookie(AUTH_COOKIE, token, { ...authCookieOptions(), maxAge: tokenMaxAgeMs(token) });
  res.json({ data: user });
};

export const logout: RequestHandler = (_req, res) => {
  res.clearCookie(AUTH_COOKIE, authCookieOptions());
  res.status(204).end();
};

export const me: RequestHandler = (req, res) => {
  if (!req.user) throw unauthorized();
  res.json({ data: req.user });
};
