import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import { jakartaDate, jakartaDayStart, jakartaNextDayStart } from "../../utils/datetime";
import { notFound } from "../../utils/errors";
import { resolveBranchId } from "../../utils/scope";
import type { AuthUser } from "../auth/service";
import { movementInclude, toMovementDto } from "../movements/service";
import { stockStatus } from "../stocks/status";
import { habisSql, menipisSql } from "../stocks/statusSql";
import type { DashboardQuery } from "./schema";

/** Jumlah baris pada tabel stok menipis dan daftar pergerakan terbaru. */
const LIST_SIZE = 10;
/** Jendela grafik distribusi (hari, termasuk hari ini, batas hari WIB). */
const DISTRIBUTION_DAYS = 30;

type LowRow = {
  branch_id: number;
  branch_code: string;
  branch_name: string;
  branch_is_main: boolean;
  product_id: number;
  sku: string;
  product_name: string;
  unit: string;
  min_stock: number;
  qty: number;
};

/**
 * Stok bermasalah per pasangan cabang × produk aktif (bagian 14): Menipis dan Habis dihitung
 * terpisah. Tanpa `branchId` hanya cabang aktif (gudang utama ikut). Kondisi SQL dipakai bersama
 * dengan `/stocks` (statusSql.ts) sehingga angkanya sama dengan halaman Stok.
 */
async function stockProblems(branchId: number | null) {
  const branchCond = branchId !== null ? Prisma.sql`b.id = ${branchId}` : Prisma.sql`b.is_active`;
  const from = Prisma.sql`
    FROM branches b
    CROSS JOIN products p
    LEFT JOIN branch_stocks bs ON bs.branch_id = b.id AND bs.product_id = p.id
    WHERE ${branchCond} AND p.is_active`;

  const [counts, rows] = await Promise.all([
    prisma.$queryRaw<{ low: number; out: number }[]>`
      SELECT count(*) FILTER (WHERE ${menipisSql})::int AS low,
             count(*) FILTER (WHERE ${habisSql})::int AS out
      ${from}`,
    prisma.$queryRaw<LowRow[]>`
      SELECT b.id AS branch_id, b.code AS branch_code, b.name AS branch_name,
             b.is_main AS branch_is_main, p.id AS product_id, p.sku,
             p.name AS product_name, p.unit, p.min_stock, COALESCE(bs.qty, 0)::int AS qty
      ${from} AND (${menipisSql} OR ${habisSql})
      ORDER BY (COALESCE(bs.qty, 0) = 0) DESC, (p.min_stock - COALESCE(bs.qty, 0)) DESC,
               b.is_main DESC, b.code ASC, p.sku ASC
      LIMIT ${LIST_SIZE}`,
  ]);

  return {
    lowStock: counts[0]?.low ?? 0,
    outOfStock: counts[0]?.out ?? 0,
    items: rows.map((r) => ({
      branch: {
        id: r.branch_id,
        code: r.branch_code,
        name: r.branch_name,
        isMain: r.branch_is_main,
      },
      product: {
        id: r.product_id,
        sku: r.sku,
        name: r.product_name,
        unit: r.unit,
        minStock: r.min_stock,
      },
      qty: r.qty,
      status: stockStatus(r.qty, r.min_stock, true),
    })),
  };
}

async function recentMovements(branchId: number | null) {
  const rows = await prisma.stockMovement.findMany({
    where: branchId !== null ? { branchId } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: movementInclude,
    take: LIST_SIZE,
  });
  return rows.map(toMovementDto);
}

/**
 * Qty dikirim per cabang tujuan untuk transfer DIKIRIM/DITERIMA yang `sent_at`-nya dalam
 * 30 hari terakhir (batas hari WIB, termasuk hari ini). Pengiriman langsung ikut dihitung.
 * Cabang aktif non-gudang tanpa pengiriman tetap tampil dengan 0.
 */
async function distribution(branchId: number | null) {
  const today = jakartaDate();
  const fromDate = jakartaDate(
    new Date(jakartaDayStart(today).getTime() - (DISTRIBUTION_DAYS - 1) * 86_400_000),
  );
  const start = jakartaDayStart(fromDate);
  const end = jakartaNextDayStart(today);

  const branchCond =
    branchId !== null ? Prisma.sql`AND t.to_branch_id = ${branchId}` : Prisma.empty;
  const [sent, branches] = await Promise.all([
    prisma.$queryRaw<{ branch_id: number; qty: number }[]>`
      SELECT t.to_branch_id AS branch_id, COALESCE(SUM(ti.qty_sent), 0)::int AS qty
      FROM stock_transfers t
      JOIN stock_transfer_items ti ON ti.transfer_id = t.id
      WHERE t.status IN ('DIKIRIM', 'DITERIMA')
        AND t.sent_at >= ${start} AND t.sent_at < ${end}
        ${branchCond}
      GROUP BY t.to_branch_id`,
    prisma.branch.findMany({
      where: branchId !== null ? { id: branchId } : { isActive: true, isMain: false },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, isMain: true },
    }),
  ]);
  const qtyOf = new Map(sent.map((s) => [s.branch_id, s.qty]));
  return {
    from: fromDate,
    to: today,
    items: branches.map((b) => ({ branch: b, qtySent: qtyOf.get(b.id) ?? 0 })),
  };
}

async function adminDashboard(branchId: number | null) {
  let branch: { id: number; code: string; name: string; isMain: boolean } | null = null;
  if (branchId !== null) {
    branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, code: true, name: true, isMain: true },
    });
    if (!branch) throw notFound("Cabang tidak ditemukan.");
  }

  // Filter cabang berlaku untuk semua angka kecuali total produk dan total cabang aktif.
  // Untuk transfer, cabang berarti cabang tujuan.
  const transferWhere = branchId !== null ? { toBranchId: branchId } : {};
  const [
    activeProducts,
    activeBranches,
    problems,
    pendingRequests,
    readyToSend,
    pendingOpnames,
    dist,
    movements,
  ] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.branch.count({ where: { isActive: true } }),
    stockProblems(branchId),
    prisma.stockTransfer.count({ where: { ...transferWhere, status: "DIAJUKAN" } }),
    prisma.stockTransfer.count({ where: { ...transferWhere, status: "DISETUJUI" } }),
    prisma.stockOpname.count({
      where: { ...(branchId !== null ? { branchId } : {}), status: "MENUNGGU" },
    }),
    distribution(branchId),
    recentMovements(branchId),
  ]);

  return {
    scope: "ADMIN" as const,
    branch,
    cards: {
      activeProducts,
      activeBranches,
      lowStock: problems.lowStock,
      outOfStock: problems.outOfStock,
      pendingRequests,
      readyToSend,
      pendingOpnames,
    },
    lowStockItems: problems.items,
    distribution: dist,
    recentMovements: movements,
  };
}

async function pegawaiDashboard(user: AuthUser) {
  const branchId = resolveBranchId(user);
  if (branchId === null) throw notFound("Cabang tidak ditemukan.");
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, code: true, name: true, isMain: true },
  });
  if (!branch) throw notFound("Cabang tidak ditemukan.");

  const [activeProducts, problems, ongoingRequests, incomingToConfirm, lastOpname, movements] =
    await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      stockProblems(branchId),
      // "Request saya yang masih berjalan" (bagian 14): request cabang ini yang DIAJUKAN/DISETUJUI/DIKIRIM.
      prisma.stockTransfer.count({
        where: {
          toBranchId: branchId,
          requestedAt: { not: null },
          status: { in: ["DIAJUKAN", "DISETUJUI", "DIKIRIM"] },
        },
      }),
      prisma.stockTransfer.count({ where: { toBranchId: branchId, status: "DIKIRIM" } }),
      prisma.stockOpname.findFirst({
        where: { branchId },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        select: { id: true, docNo: true, date: true, status: true, verifyNote: true },
      }),
      recentMovements(branchId),
    ]);

  return {
    scope: "PEGAWAI" as const,
    branch,
    cards: {
      activeProducts,
      lowStock: problems.lowStock,
      outOfStock: problems.outOfStock,
      ongoingRequests,
      incomingToConfirm,
    },
    lowStockItems: problems.items,
    lastOpname: lastOpname
      ? { ...lastOpname, date: lastOpname.date.toISOString().slice(0, 10) }
      : null,
    recentMovements: movements,
  };
}

/** Isi dashboard sesuai role (bagian 4.9). Pegawai Cabang selalu cabangnya sendiri. */
export async function getDashboard(query: DashboardQuery, user: AuthUser) {
  if (user.role === "PEGAWAI_CABANG") return pegawaiDashboard(user);
  return adminDashboard(resolveBranchId(user, query.branchId));
}
