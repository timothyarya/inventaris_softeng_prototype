import { z } from "zod";
import { isValidDateString, jakartaDate } from "../../utils/datetime";
import { optionalText } from "../../utils/http";
import { paginationQuery } from "../../utils/pagination";

/** Batas qty fisik per item dan jumlah baris per opname (keputusan Fase 5). */
export const MAX_ITEM_QTY = 1_000_000;
export const MAX_ITEMS = 1000;
export const MAX_REMARK = 255;

const OPNAME_STATUSES = ["MENUNGGU", "DISETUJUI", "DITOLAK"] as const;

const positiveId = (label: string) =>
  z.coerce
    .number({ error: `${label} tidak valid` })
    .int(`${label} tidak valid`)
    .positive(`${label} tidak valid`);

const dateString = (label: string) =>
  z
    .string({ error: `${label} wajib diisi` })
    .refine(isValidDateString, `${label} tidak valid (format YYYY-MM-DD)`);

const itemSchema = z.object({
  productId: positiveId("Produk"),
  // 0 sah: produk dihitung dan ternyata kosong.
  qtyPhysical: z
    .number({ error: "Qty fisik harus berupa angka" })
    .int("Qty fisik harus bilangan bulat")
    .min(0, "Qty fisik tidak boleh negatif")
    .max(MAX_ITEM_QTY, `Qty fisik maksimal ${MAX_ITEM_QTY.toLocaleString("id-ID")} per item`),
  remark: optionalText(MAX_REMARK, "Keterangan"),
});

export const createOpnameSchema = z
  .object({
    // Wajib untuk Owner/Admin Gudang; diabaikan untuk Pegawai Cabang (selalu cabangnya sendiri).
    branchId: positiveId("Cabang").optional(),
    // Tanggal penghitungan: default hari ini (WIB), boleh mundur, tidak boleh di masa depan.
    date: dateString("Tanggal")
      .optional()
      .refine((v) => v === undefined || v <= jakartaDate(), "Tanggal tidak boleh di masa depan"),
    note: optionalText(2000, "Catatan"),
    items: z
      .array(itemSchema, { error: "Item wajib diisi" })
      .min(1, "Minimal satu produk harus dihitung")
      .max(MAX_ITEMS, `Maksimal ${MAX_ITEMS} item per opname`),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<number>();
    value.items.forEach((item, index) => {
      if (seen.has(item.productId)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "productId"],
          message: "Produk dipilih lebih dari sekali",
        });
      }
      seen.add(item.productId);
    });
  })
  .transform((value) => ({ ...value, date: value.date ?? jakartaDate() }));

export const prefillQuerySchema = z.object({
  branchId: positiveId("Cabang").optional(),
});

export const approveSchema = z.object({
  verifyNote: optionalText(1000, "Catatan verifikasi"),
});

export const rejectSchema = z.object({
  verifyNote: z
    .string({ error: "Catatan verifikasi wajib diisi" })
    .trim()
    .min(1, "Catatan verifikasi wajib diisi")
    .max(1000, "Catatan verifikasi maksimal 1000 karakter"),
});

export const listOpnamesQuerySchema = z
  .object({
    ...paginationQuery,
    q: z.string().trim().optional(),
    // Satu status atau beberapa dipisah koma, mis. ?status=MENUNGGU,DITOLAK
    status: z
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
      .pipe(z.array(z.enum(OPNAME_STATUSES, { error: "Status tidak valid" })).optional()),
    // Diabaikan untuk Pegawai Cabang (selalu cabangnya sendiri).
    branchId: positiveId("Cabang").optional(),
    // Rentang tanggal opname (bukan tanggal dibuat), inklusif.
    from: dateString("Tanggal mulai").optional(),
    to: dateString("Tanggal akhir").optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "Tanggal mulai tidak boleh setelah tanggal akhir",
    path: ["from"],
  });

export type CreateOpnameInput = z.infer<typeof createOpnameSchema>;
export type PrefillQuery = z.infer<typeof prefillQuerySchema>;
export type ApproveInput = z.infer<typeof approveSchema>;
export type RejectInput = z.infer<typeof rejectSchema>;
export type ListOpnamesQuery = z.infer<typeof listOpnamesQuerySchema>;
