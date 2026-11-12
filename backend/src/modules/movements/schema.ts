import { z } from "zod";
import { isValidDateString } from "../../utils/datetime";
import { paginationQuery } from "../../utils/pagination";

const MOVEMENT_TYPES = ["MASUK", "TRANSFER_OUT", "TRANSFER_IN", "OPNAME"] as const;

const id = (label: string) =>
  z.coerce
    .number({ error: `${label} tidak valid` })
    .int(`${label} tidak valid`)
    .positive(`${label} tidak valid`);

const dateString = (label: string) =>
  z
    .string({ error: `${label} wajib diisi` })
    .refine(isValidDateString, `${label} tidak valid (format YYYY-MM-DD)`);

export const listMovementsQuerySchema = z
  .object({
    ...paginationQuery,
    // Pegawai Cabang: diabaikan, selalu cabangnya sendiri. Owner/Admin Gudang: kosong = semua cabang.
    branchId: id("Cabang").optional(),
    productId: id("Produk").optional(),
    // Satu tipe atau beberapa dipisah koma, mis. ?type=TRANSFER_IN,OPNAME
    type: z
      .string()
      .optional()
      .transform((v) =>
        v
          ? v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      )
      .pipe(z.array(z.enum(MOVEMENT_TYPES, { error: "Tipe pergerakan tidak valid" })).optional()),
    // Rentang tanggal memakai batas hari Asia/Jakarta, inklusif (bagian 5.6).
    from: dateString("Tanggal mulai").optional(),
    to: dateString("Tanggal akhir").optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "Tanggal mulai tidak boleh setelah tanggal akhir",
    path: ["from"],
  });

export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;
