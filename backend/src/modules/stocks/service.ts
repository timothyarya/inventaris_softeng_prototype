import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import { notFound } from "../../utils/errors";
import { pageMeta } from "../../utils/pagination";
import { resolveBranchId } from "../../utils/scope";
import type { AuthUser } from "../auth/service";
import type { ListStocksQuery } from "./schema";

type StockRow = {
  branch_id: number;
  branch_code: string;
  branch_name: string;
  branch_is_main: boolean;
  branch_is_active: boolean;
  product_id: number;
  sku: string;
  product_name: string;
  unit: string;
  min_stock: number;
  product_is_active: boolean;
  category_name: string | null;
  qty: number;
};

/**
 * Stok per cabang × produk (bagian 7, 9). Produk tanpa baris `branch_stocks` dianggap qty 0
 * (bagian 14). Produk nonaktif hanya tampil bila masih ada stoknya (untuk Pegawai: tidak
 * pernah tampil). Stok menipis: `qty < min_stock`, hanya produk aktif dengan `min_stock > 0`.
 */
export async function listStocks(query: ListStocksQuery, user: AuthUser) {
  // Pegawai: cabang selalu dari server, parameter client diabaikan (bagian 3.3).
  const branchId = resolveBranchId(user, query.branchId);

  if (branchId !== null) {
    const exists = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });
    if (!exists) throw notFound("Cabang tidak ditemukan.");
  }
  if (query.productId) {
    const exists = await prisma.product.findUnique({
      where: { id: query.productId },
      select: { id: true },
    });
    if (!exists) throw notFound("Produk tidak ditemukan.");
  }

  const conditions: Prisma.Sql[] = [];
  // Tanpa filter cabang, hanya cabang aktif; cabang nonaktif tetap bisa dilihat bila dipilih langsung.
  conditions.push(branchId !== null ? Prisma.sql`b.id = ${branchId}` : Prisma.sql`b.is_active`);
  conditions.push(
    user.role === "PEGAWAI"
      ? Prisma.sql`p.is_active`
      : Prisma.sql`(p.is_active OR COALESCE(bs.qty, 0) > 0)`,
  );
  if (query.productId) conditions.push(Prisma.sql`p.id = ${query.productId}`);
  if (query.q) {
    const like = `%${query.q}%`;
    conditions.push(Prisma.sql`(p.sku ILIKE ${like} OR p.name ILIKE ${like})`);
  }
  if (query.lowOnly) {
    conditions.push(
      Prisma.sql`(p.is_active AND p.min_stock > 0 AND COALESCE(bs.qty, 0) < p.min_stock)`,
    );
  }
  const where = Prisma.join(conditions, " AND ");

  const from = Prisma.sql`
    FROM branches b
    CROSS JOIN products p
    LEFT JOIN branch_stocks bs ON bs.branch_id = b.id AND bs.product_id = p.id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${where}`;

  const offset = (query.page - 1) * query.pageSize;
  const [rows, count] = await Promise.all([
    prisma.$queryRaw<StockRow[]>`
      SELECT b.id AS branch_id, b.code AS branch_code, b.name AS branch_name,
             b.is_main AS branch_is_main, b.is_active AS branch_is_active,
             p.id AS product_id, p.sku, p.name AS product_name, p.unit, p.min_stock,
             p.is_active AS product_is_active, c.name AS category_name,
             COALESCE(bs.qty, 0)::int AS qty
      ${from}
      ORDER BY b.is_main DESC, b.code ASC, p.sku ASC
      LIMIT ${query.pageSize} OFFSET ${offset}`,
    prisma.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${from}`,
  ]);

  const data = rows.map((r) => ({
    branch: {
      id: r.branch_id,
      code: r.branch_code,
      name: r.branch_name,
      isMain: r.branch_is_main,
      isActive: r.branch_is_active,
    },
    product: {
      id: r.product_id,
      sku: r.sku,
      name: r.product_name,
      unit: r.unit,
      minStock: r.min_stock,
      isActive: r.product_is_active,
      category: r.category_name,
    },
    qty: r.qty,
    isLow: r.product_is_active && r.min_stock > 0 && r.qty < r.min_stock,
  }));

  return { data, meta: pageMeta(query, count[0]?.total ?? 0) };
}
