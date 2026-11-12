import { Prisma } from "../../generated/prisma/client";

/**
 * Kondisi SQL status stok (bagian 14) untuk query dengan alias `p` (products) dan
 * `bs` (branch_stocks, LEFT JOIN: tanpa baris dianggap qty 0). Harus sejalan dengan
 * `stockStatus` di status.ts. Dipakai bersama oleh `/stocks` dan `/dashboard` agar angkanya sama.
 */
export const habisSql = Prisma.sql`(p.is_active AND COALESCE(bs.qty, 0) = 0)`;
export const menipisSql = Prisma.sql`(p.is_active AND COALESCE(bs.qty, 0) > 0 AND p.min_stock > 0 AND COALESCE(bs.qty, 0) < p.min_stock)`;
export const amanSql = Prisma.sql`(p.is_active AND COALESCE(bs.qty, 0) > 0 AND (p.min_stock = 0 OR COALESCE(bs.qty, 0) >= p.min_stock))`;
