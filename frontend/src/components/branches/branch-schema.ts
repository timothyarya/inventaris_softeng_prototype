import { z } from "zod";

// Aturan sama dengan backend (modules/branches/schema.ts). Tanpa transform: normalisasi
// (huruf besar, string kosong -> null) dilakukan saat submit.
export const branchNameSchema = z
  .string()
  .trim()
  .min(1, "Nama cabang wajib diisi")
  .max(100, "Nama cabang maksimal 100 karakter");

export const branchCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{2,20}$/, "Kode cabang hanya boleh huruf dan angka, 2–20 karakter");

const addressSchema = z.string().trim().max(255, "Alamat maksimal 255 karakter");
const phoneSchema = z.string().trim().max(30, "Telepon maksimal 30 karakter");

export const branchCreateSchema = z.object({
  code: branchCodeSchema,
  name: branchNameSchema,
  address: addressSchema,
  phone: phoneSchema,
});

export const branchEditSchema = z.object({
  name: branchNameSchema,
  address: addressSchema,
  phone: phoneSchema,
});

export type BranchCreateValues = z.infer<typeof branchCreateSchema>;
export type BranchEditValues = z.infer<typeof branchEditSchema>;

export const emptyToNull = (value: string) => (value.trim() === "" ? null : value.trim());
