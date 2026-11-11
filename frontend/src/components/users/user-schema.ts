import { z } from "zod";

// Aturan sama dengan backend (modules/users/schema.ts, utils/password.ts).
const nameSchema = z
  .string()
  .trim()
  .min(1, "Nama wajib diisi")
  .max(100, "Nama maksimal 100 karakter");
const emailSchema = z
  .string()
  .trim()
  .min(1, "Email wajib diisi")
  .max(150, "Email maksimal 150 karakter")
  .pipe(z.email("Format email tidak valid"));
const passwordRule = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(72, "Password maksimal 72 karakter");

const roleSchema = z.enum(["OWNER", "ADMIN_CABANG", "PEGAWAI_CABANG"]);

// branchId disimpan sebagai string dari <select>; "" berarti belum ditugaskan.
export const userCreateSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordRule,
  role: roleSchema,
  branchId: z.string(),
});

export const userEditSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  // Kosong = password tidak diubah.
  password: z.union([z.literal(""), passwordRule]),
  role: roleSchema,
  branchId: z.string(),
});

export type UserFormValues = z.infer<typeof userCreateSchema>;
