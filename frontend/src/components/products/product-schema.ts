import { z } from "zod";

// Aturan sama dengan backend (modules/products/schema.ts).
export const productSchema = z.object({
  sku: z.string().trim().min(1, "SKU wajib diisi").max(50, "SKU maksimal 50 karakter"),
  name: z.string().trim().min(1, "Nama produk wajib diisi").max(150, "Nama maksimal 150 karakter"),
  unit: z.string().trim().min(1, "Satuan wajib diisi").max(20, "Satuan maksimal 20 karakter"),
  // Diisi lewat valueAsNumber; field kosong menjadi NaN.
  minStock: z
    .number({ message: "Stok minimum harus berupa angka" })
    .int("Stok minimum harus bilangan bulat")
    .min(0, "Stok minimum tidak boleh negatif"),
  // "" = tanpa kategori.
  categoryId: z.string(),
});

export type ProductFormValues = z.infer<typeof productSchema>;
