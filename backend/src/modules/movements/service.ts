import { prisma } from "../../config/prisma";
import type { Prisma } from "../../generated/prisma/client";
import { jakartaDayStart, jakartaNextDayStart } from "../../utils/datetime";
import { notFound } from "../../utils/errors";
import { pageMeta, skipTake } from "../../utils/pagination";
import { resolveBranchId } from "../../utils/scope";
import type { AuthUser } from "../auth/service";
import type { ListMovementsQuery } from "./schema";

const include = {
  branch: { select: { id: true, code: true, name: true, isMain: true } },
  product: { select: { id: true, sku: true, name: true, unit: true, isActive: true } },
  user: { select: { id: true, name: true } },
} as const;

type Row = Prisma.StockMovementGetPayload<{ include: typeof include }>;

function toDto(row: Row) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    branch: row.branch,
    product: row.product,
    type: row.type,
    // Bertanda: positif menambah, negatif mengurangi.
    qty: row.qty,
    balanceAfter: row.balanceAfter,
    refType: row.refType,
    refId: row.refId,
    refDocNo: row.refDocNo,
    user: row.user,
  };
}

/**
 * Riwayat pergerakan stok (bagian 4.7): buku besar append-only, terbaru dulu.
 * Pegawai Cabang selalu dibatasi ke cabangnya (parameter client diabaikan, bagian 3.3).
 * Cabang dan produk nonaktif tetap dapat difilter karena riwayatnya tetap bisa dilihat (bagian 14).
 */
export async function listMovements(query: ListMovementsQuery, user: AuthUser) {
  const branchId = resolveBranchId(user, query.branchId);

  if (branchId !== null) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });
    if (!branch) throw notFound("Cabang tidak ditemukan.");
  }
  if (query.productId !== undefined) {
    const product = await prisma.product.findUnique({
      where: { id: query.productId },
      select: { id: true },
    });
    if (!product) throw notFound("Produk tidak ditemukan.");
  }

  const where: Prisma.StockMovementWhereInput = {
    ...(branchId !== null ? { branchId } : {}),
    ...(query.productId !== undefined ? { productId: query.productId } : {}),
    ...(query.type ? { type: { in: query.type } } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: jakartaDayStart(query.from) } : {}),
            ...(query.to ? { lt: jakartaNextDayStart(query.to) } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.stockMovement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include,
      ...skipTake(query),
    }),
    prisma.stockMovement.count({ where }),
  ]);
  return { data: rows.map(toDto), meta: pageMeta(query, total) };
}
