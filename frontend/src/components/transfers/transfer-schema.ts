import { z } from "zod";
import { MAX_ITEMS, MAX_ITEM_QTY } from "@/components/stock-ins/stock-in-schema";

// Aturan sama dengan backend (modules/transfers/schema.ts).
export { MAX_ITEMS, MAX_ITEM_QTY };

const itemsSchema = z
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
  .max(MAX_ITEMS, `Maksimal ${MAX_ITEMS} item per dokumen`);

const noDuplicateProducts = (value: { items: { productId: string }[] }, ctx: z.RefinementCtx) => {
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
};

/**
 * Satu bentuk nilai form untuk kedua mode. Request Pegawai Cabang memakai cabangnya sendiri
 * (toBranchId tidak diisi); pengiriman langsung Owner/Admin Gudang wajib memilih tujuan.
 */
export const transferFormSchema = (requireBranch: boolean) =>
  z
    .object({
      toBranchId: requireBranch ? z.string().min(1, "Pilih cabang tujuan") : z.string(),
      note: z.string().trim().max(2000, "Catatan maksimal 2000 karakter"),
      items: itemsSchema,
    })
    .superRefine(noDuplicateProducts);

export type TransferFormValues = z.infer<ReturnType<typeof transferFormSchema>>;
