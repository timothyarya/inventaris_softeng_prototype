import { z } from "zod";
import { paginationQuery } from "../../utils/pagination";

const id = (label: string) =>
  z.coerce
    .number({ error: `${label} tidak valid` })
    .int(`${label} tidak valid`)
    .positive(`${label} tidak valid`);

export const listStocksQuerySchema = z.object({
  ...paginationQuery,
  // Pegawai Cabang: diabaikan, selalu cabangnya sendiri. Owner/Admin Cabang: kosong = semua cabang aktif.
  branchId: id("Cabang").optional(),
  productId: id("Produk").optional(),
  q: z.string().trim().optional(),
  // Filter satu status. Produk nonaktif tidak termasuk status mana pun (tidak dipantau).
  status: z.enum(["AMAN", "MENIPIS", "HABIS"], { error: "Status stok tidak valid" }).optional(),
  // Singkatan "perlu perhatian": MENIPIS atau HABIS.
  lowOnly: z
    .enum(["true", "false"], { error: "lowOnly harus true atau false" })
    .optional()
    .transform((v) => v === "true"),
});

export type ListStocksQuery = z.infer<typeof listStocksQuerySchema>;
