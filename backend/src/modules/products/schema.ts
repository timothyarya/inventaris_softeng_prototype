import { z } from "zod";
import { paginationQuery } from "../../utils/pagination";

const sku = z
  .string({ error: "SKU wajib diisi" })
  .trim()
  .min(1, "SKU wajib diisi")
  .max(50, "SKU maksimal 50 karakter");
const name = z
  .string({ error: "Nama produk wajib diisi" })
  .trim()
  .min(1, "Nama produk wajib diisi")
  .max(150, "Nama produk maksimal 150 karakter");
const unit = z
  .string({ error: "Satuan wajib diisi" })
  .trim()
  .min(1, "Satuan wajib diisi")
  .max(20, "Satuan maksimal 20 karakter");
const minStock = z
  .number({ error: "Stok minimum harus berupa angka" })
  .int("Stok minimum harus bilangan bulat")
  .min(0, "Stok minimum tidak boleh negatif");
const categoryId = z
  .number({ error: "Kategori tidak valid" })
  .int("Kategori tidak valid")
  .positive("Kategori tidak valid")
  .nullable();

export const createProductSchema = z.object({
  sku,
  name,
  unit,
  minStock: minStock.default(0),
  categoryId: categoryId.optional().transform((v) => v ?? null),
});

export const updateProductSchema = z
  .object({
    sku: sku.optional(),
    name: name.optional(),
    unit: unit.optional(),
    minStock: minStock.optional(),
    categoryId: categoryId.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { error: "Tidak ada data yang diubah" });

export const listProductsQuerySchema = z.object({
  ...paginationQuery,
  q: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: z.enum(["active", "inactive", "all"]).default("all"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
