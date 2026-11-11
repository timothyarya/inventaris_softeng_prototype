import { z } from "zod";
import { paginationQuery } from "../../utils/pagination";

export const categoryBodySchema = z.object({
  name: z
    .string({ error: "Nama kategori wajib diisi" })
    .trim()
    .min(1, "Nama kategori wajib diisi")
    .max(100, "Nama kategori maksimal 100 karakter"),
});

export const listCategoriesQuerySchema = z.object({
  ...paginationQuery,
  q: z.string().trim().optional(),
});

export type CategoryBody = z.infer<typeof categoryBodySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
