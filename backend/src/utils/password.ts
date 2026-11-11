import bcrypt from "bcrypt";
import { z } from "zod";

const BCRYPT_COST = 10;

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_COST);

/** Aturan password user baru / reset: minimal 8 karakter (bcrypt hanya memakai 72 byte pertama). */
export const passwordSchema = z
  .string({ error: "Password wajib diisi" })
  .min(8, "Password minimal 8 karakter")
  .max(72, "Password maksimal 72 karakter");
