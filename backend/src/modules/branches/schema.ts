import { z } from "zod";
import { optionalText } from "../../utils/http";
import { paginationQuery } from "../../utils/pagination";

const code = z
  .string({ error: "Kode cabang wajib diisi" })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,20}$/, "Kode cabang hanya boleh huruf besar dan angka, 2–20 karakter");
const name = z
  .string({ error: "Nama cabang wajib diisi" })
  .trim()
  .min(1, "Nama cabang wajib diisi")
  .max(100, "Nama cabang maksimal 100 karakter");

export const createBranchSchema = z.object({
  code,
  name,
  address: optionalText(255, "Alamat"),
  phone: optionalText(30, "Telepon"),
});

// Kode dan status gudang utama tidak boleh diubah lewat PATCH (bagian 4.1 + keputusan Fase 2).
const immutable = (message: string) => z.never({ error: message }).optional();

export const updateBranchSchema = z
  .object({
    name: name.optional(),
    address: optionalText(255, "Alamat"),
    phone: optionalText(30, "Telepon"),
    code: immutable("Kode cabang tidak dapat diubah"),
    isMain: immutable("Status gudang utama tidak dapat diubah"),
    isActive: immutable("Gunakan endpoint aktifkan/nonaktifkan untuk mengubah status cabang"),
  })
  .refine((v) => v.name !== undefined || v.address !== undefined || v.phone !== undefined, {
    error: "Tidak ada data yang diubah",
  });

export const listBranchesQuerySchema = z.object({
  ...paginationQuery,
  q: z.string().trim().optional(),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;
