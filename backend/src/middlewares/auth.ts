import type { RequestHandler } from "express";
import { findAuthUserById, toAuthUser } from "../modules/auth/service";
import { forbidden, unauthorized } from "../utils/errors";
import { AUTH_COOKIE, verifyToken } from "../utils/jwt";

/**
 * Memverifikasi cookie JWT dan MEMUAT ULANG user dari DB di setiap request,
 * sehingga penonaktifan user (is_active = false) berlaku seketika (bagian 3.3).
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== "string" || token === "") throw unauthorized();

  const userId = verifyToken(token);
  const user = await findAuthUserById(userId);
  if (!user || !user.isActive) throw unauthorized();

  req.user = toAuthUser(user);
  next();
};

/**
 * Pegawai tanpa cabang (branch_id = NULL) hanya boleh memakai /auth/*.
 * Pasang pada semua rute data (bagian 3.1).
 */
export const requireAssignedBranch: RequestHandler = (req, _res, next) => {
  if (!req.user) throw unauthorized();
  if (req.user.role === "PEGAWAI" && req.user.branchId === null) {
    throw forbidden("Anda belum ditugaskan ke cabang. Hubungi Owner.");
  }
  next();
};
