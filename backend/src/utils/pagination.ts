import { z } from "zod";

/** Field query paginasi `?page=&pageSize=` (bagian 7). */
export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export type PageParams = { page: number; pageSize: number };

export const skipTake = ({ page, pageSize }: PageParams) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

export const pageMeta = ({ page, pageSize }: PageParams, total: number) => ({
  page,
  pageSize,
  total,
});
