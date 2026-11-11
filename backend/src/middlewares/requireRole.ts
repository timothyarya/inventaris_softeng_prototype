import type { RequestHandler } from "express";
import type { Role } from "../generated/prisma/enums";
import { forbidden, unauthorized } from "../utils/errors";

/** Membatasi rute ke role tertentu. Wajib dipasang setelah `authenticate`. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
