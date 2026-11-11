import { z } from "zod";
import { todayJakarta } from "@/lib/format";

// Aturan sama dengan backend (modules/stock-ins/schema.ts).
export const MAX_ITEM_QTY = 1_000_000;
export const MAX_ITEMS = 200;

export const stockInSchema = z
  .object({
    date: z
      .string()
      .min(1, "Tanggal wajib diisi")
      .refine((v) => v <= todayJakarta(), "Tanggal tidak boleh di masa depan"),
    supplierName: z
      .string()
      .trim()
      .min(1, "Nama supplier wajib diisi")
      .max(150, "Nama supplier maksimal 150 karakter"),
    invoiceNo: z.string().trim().max(50, "No. faktur maksimal 50 karakter"),
    note: z.string().trim().max(2000, "Catatan maksimal 2000 karakter"),
    items: z
      .array(
        z.object({
          // "" = belum dipilih.
          productId: z.string().min(1, "Pilih produk"),
          // valueAsNumber: kolom kosong menjadi NaN.
          qty: z
            .number({ message: "Qty harus berupa angka" })
            .int("Qty harus bilangan bulat")
            .min(1, "Qty harus lebih dari 0")
            .max(MAX_ITEM_QTY, `Qty maksimal ${MAX_ITEM_QTY.toLocaleString("id-ID")}`),
        }),
      )
      .min(1, "Minimal satu item")
      .max(MAX_ITEMS, `Maksimal ${MAX_ITEMS} item per dokumen`),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.items.forEach((item, index) => {
      if (item.productId && seen.has(item.productId)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "productId"],
          message: "Produk dipilih lebih dari sekali",
        });
      }
      seen.add(item.productId);
    });
  });

export type StockInFormValues = z.infer<typeof stockInSchema>;
