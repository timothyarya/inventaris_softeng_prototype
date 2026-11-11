import { z } from "zod";
import { isValidDateString } from "../../utils/datetime";
import { optionalText } from "../../utils/http";
import { paginationQuery } from "../../utils/pagination";

/** Batas per item dan per dokumen; sama dengan stok masuk (keputusan Fase 3/4). */
export const MAX_ITEM_QTY = 1_000_000;
export const MAX_ITEMS = 200;

const TRANSFER_STATUSES = [
  "DIAJUKAN",
  "DISETUJUI",
  "DITOLAK",
  "DIBATALKAN",
  "DIKIRIM",
  "DITERIMA",
] as const;

const positiveId = (label: string) =>
  z.coerce
    .number({ error: `${label} tidak valid` })
    .int(`${label} tidak valid`)
    .positive(`${label} tidak valid`);

const qty = (min: number, label = "Qty") =>
  z
    .number({ error: `${label} harus berupa angka` })
    .int(`${label} harus bilangan bulat`)
    .min(min, min === 0 ? `${label} tidak boleh negatif` : `${label} harus lebih dari 0`)
    .max(MAX_ITEM_QTY, `${label} maksimal ${MAX_ITEM_QTY.toLocaleString("id-ID")} per item`);

const dateString = (label: string) =>
  z
    .string({ error: `${label} wajib diisi` })
    .refine(isValidDateString, `${label} tidak valid (format YYYY-MM-DD)`);

/** Item baru (request atau pengiriman langsung): produk + qty > 0, tanpa produk ganda. */
const newItems = z
  .array(
    z.object({
      productId: positiveId("Produk"),
      qty: qty(1),
    }),
    { error: "Item wajib diisi" },
  )
  .min(1, "Minimal satu item")
  .max(MAX_ITEMS, `Maksimal ${MAX_ITEMS} item per dokumen`)
  .superRefine((items, ctx) => {
    const seen = new Set<number>();
    items.forEach((item, index) => {
      if (seen.has(item.productId)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "productId"],
          message: "Produk dipilih lebih dari sekali",
        });
      }
      seen.add(item.productId);
    });
  });

/** Id item tidak boleh dobel dalam satu permintaan penyesuaian. */
const uniqueItemIds = (items: { itemId: number }[], ctx: z.RefinementCtx) => {
  const seen = new Set<number>();
  items.forEach((item, index) => {
    if (seen.has(item.itemId)) {
      ctx.addIssue({ code: "custom", path: [index, "itemId"], message: "Item ganda" });
    }
    seen.add(item.itemId);
  });
};

/** Penyesuaian qty per item yang sudah ada; item yang tidak disebut memakai nilai default. */
const approveItems = z
  .array(z.object({ itemId: positiveId("Item"), qtyApproved: qty(0) }))
  .max(MAX_ITEMS)
  .superRefine(uniqueItemIds)
  .optional();
const sendItems = z
  .array(z.object({ itemId: positiveId("Item"), qtySent: qty(0) }))
  .max(MAX_ITEMS)
  .superRefine(uniqueItemIds)
  .optional();
const receiveItems = z
  .array(z.object({ itemId: positiveId("Item"), qtyReceived: qty(0) }))
  .max(MAX_ITEMS)
  .superRefine(uniqueItemIds)
  .optional();

export const createRequestSchema = z.object({
  note: optionalText(2000, "Catatan"),
  items: newItems,
});

export const createDirectSchema = z.object({
  toBranchId: positiveId("Cabang tujuan"),
  note: optionalText(2000, "Catatan"),
  items: newItems,
});

export const approveSchema = z.object({ items: approveItems });
export const sendSchema = z.object({ items: sendItems });
export const receiveSchema = z.object({ items: receiveItems });

export const rejectSchema = z.object({
  reason: z
    .string({ error: "Alasan penolakan wajib diisi" })
    .trim()
    .min(1, "Alasan penolakan wajib diisi")
    .max(1000, "Alasan penolakan maksimal 1000 karakter"),
});

export const listTransfersQuerySchema = z
  .object({
    ...paginationQuery,
    q: z.string().trim().optional(),
    // Satu status atau beberapa dipisah koma, mis. ?status=DIAJUKAN,DISETUJUI
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
      .pipe(z.array(z.enum(TRANSFER_STATUSES, { error: "Status tidak valid" })).optional()),
    // Cabang tujuan. Diabaikan untuk Pegawai Cabang (selalu cabangnya sendiri).
    branchId: positiveId("Cabang").optional(),
    origin: z.enum(["request", "direct"], { error: "origin harus request atau direct" }).optional(),
    from: dateString("Tanggal mulai").optional(),
    to: dateString("Tanggal akhir").optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "Tanggal mulai tidak boleh setelah tanggal akhir",
    path: ["from"],
  });

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type CreateDirectInput = z.infer<typeof createDirectSchema>;
export type ApproveInput = z.infer<typeof approveSchema>;
export type SendInput = z.infer<typeof sendSchema>;
export type ReceiveInput = z.infer<typeof receiveSchema>;
export type RejectInput = z.infer<typeof rejectSchema>;
export type ListTransfersQuery = z.infer<typeof listTransfersQuerySchema>;
