import { z } from "zod";
import { isValidDateString, jakartaDate } from "../../utils/datetime";
import { optionalText } from "../../utils/http";
import { paginationQuery } from "../../utils/pagination";

/** Batas qty per item: mencegah salah ketik (mis. kelebihan nol). Keputusan Fase 3. */
export const MAX_ITEM_QTY = 1_000_000;
/** Batas jumlah baris item per dokumen, agar satu transaksi tetap wajar. */
export const MAX_ITEMS = 200;

const dateString = (label: string) =>
  z
    .string({ error: `${label} wajib diisi` })
    .refine(isValidDateString, `${label} tidak valid (format YYYY-MM-DD)`);

const itemSchema = z.object({
  productId: z.coerce
    .number({ error: "Produk wajib dipilih" })
    .int("Produk tidak valid")
    .positive("Produk tidak valid"),
  qty: z
    .number({ error: "Qty harus berupa angka" })
    .int("Qty harus bilangan bulat")
    .min(1, "Qty harus lebih dari 0")
    .max(MAX_ITEM_QTY, `Qty maksimal ${MAX_ITEM_QTY.toLocaleString("id-ID")} per item`),
});

export const createStockInSchema = z
  .object({
    // Default hari ini (WIB); boleh mundur, tidak boleh melewati hari ini.
    date: dateString("Tanggal")
      .optional()
      .refine((v) => v === undefined || v <= jakartaDate(), "Tanggal tidak boleh di masa depan"),
    supplierName: z
      .string({ error: "Nama supplier wajib diisi" })
      .trim()
      .min(1, "Nama supplier wajib diisi")
      .max(150, "Nama supplier maksimal 150 karakter"),
    invoiceNo: optionalText(50, "No. faktur"),
    note: optionalText(2000, "Catatan"),
    items: z
      .array(itemSchema, { error: "Item wajib diisi" })
      .min(1, "Minimal satu item")
      .max(MAX_ITEMS, `Maksimal ${MAX_ITEMS} item per dokumen`),
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

export const listStockInsQuerySchema = z
  .object({
    ...paginationQuery,
    q: z.string().trim().optional(),
    from: dateString("Tanggal mulai").optional(),
    to: dateString("Tanggal akhir").optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "Tanggal mulai tidak boleh setelah tanggal akhir",
    path: ["from"],
  });

export type CreateStockInInput = z.infer<typeof createStockInSchema>;
export type ListStockInsQuery = z.infer<typeof listStockInsQuerySchema>;
