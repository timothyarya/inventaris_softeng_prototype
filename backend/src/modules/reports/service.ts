import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import { jakartaDayStart, jakartaNextDayStart } from "../../utils/datetime";
import { notFound } from "../../utils/errors";
import { stockStatus } from "../stocks/status";
import type { ReportQuery } from "./schema";

const branchSelect = { id: true, code: true, name: true, isMain: true } as const;

async function findBranch(branchId: number | undefined) {
  if (branchId === undefined) return null;
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: branchSelect });
  if (!branch) throw notFound("Cabang tidak ditemukan.");
  return branch;
}

type StockRow = {
  branch_id: number;
  branch_code: string;
  branch_name: string;
  branch_is_main: boolean;
  product_id: number;
  sku: string;
  product_name: string;
  unit: string;
  min_stock: number;
  is_active: boolean;
  opening: number;
  masuk: number;
  transfer_in: number;
  transfer_out: number;
  opname: number;
};

/**
 * Laporan Stok (bagian 4.8): per cabang × produk, dihitung dari buku besar `stock_movements`.
 * Stok awal = jumlah qty sebelum 00:00 WIB tanggal mulai; stok akhir = stok awal + seluruh
 * pergerakan dalam periode, sehingga untuk periode yang berakhir hari ini sama dengan
 * `branch_stocks.qty`. Hanya pasangan yang punya stok awal atau pergerakan dalam periode yang
 * tampil. Cabang/produk nonaktif tetap tampil karena riwayatnya ada. Status Menipis/Habis
 * mengikuti stok AKHIR periode dengan aturan status yang sama (stocks/status.ts).
 */
export async function stockReport(query: ReportQuery) {
  const branch = await findBranch(query.branchId);
  const start = jakartaDayStart(query.from);
  const end = jakartaNextDayStart(query.to);
  const branchCond = branch ? Prisma.sql`AND m.branch_id = ${branch.id}` : Prisma.empty;

  const rows = await prisma.$queryRaw<StockRow[]>`
    SELECT b.id AS branch_id, b.code AS branch_code, b.name AS branch_name, b.is_main AS branch_is_main,
           p.id AS product_id, p.sku, p.name AS product_name, p.unit, p.min_stock, p.is_active,
           a.opening, a.masuk, a.transfer_in, a.transfer_out, a.opname
    FROM (
      SELECT m.branch_id, m.product_id,
             COALESCE(SUM(m.qty) FILTER (WHERE m.created_at < ${start}), 0)::int AS opening,
             COALESCE(SUM(m.qty) FILTER (WHERE m.created_at >= ${start} AND m.type = 'MASUK'), 0)::int AS masuk,
             COALESCE(SUM(m.qty) FILTER (WHERE m.created_at >= ${start} AND m.type = 'TRANSFER_IN'), 0)::int AS transfer_in,
             COALESCE(SUM(m.qty) FILTER (WHERE m.created_at >= ${start} AND m.type = 'TRANSFER_OUT'), 0)::int AS transfer_out,
             COALESCE(SUM(m.qty) FILTER (WHERE m.created_at >= ${start} AND m.type = 'OPNAME'), 0)::int AS opname,
             COUNT(*) FILTER (WHERE m.created_at >= ${start})::int AS in_period
      FROM stock_movements m
      WHERE m.created_at < ${end} ${branchCond}
      GROUP BY m.branch_id, m.product_id
    ) a
    JOIN branches b ON b.id = a.branch_id
    JOIN products p ON p.id = a.product_id
    WHERE a.opening <> 0 OR a.in_period > 0
    ORDER BY b.is_main DESC, b.code ASC, p.sku ASC`;

  let lowStock = 0;
  let outOfStock = 0;
  const data = rows.map((r) => {
    const closing = r.opening + r.masuk + r.transfer_in + r.transfer_out + r.opname;
    const status = stockStatus(closing, r.min_stock, r.is_active);
    if (status === "MENIPIS") lowStock++;
    if (status === "HABIS") outOfStock++;
    return {
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
        isActive: r.is_active,
      },
      opening: r.opening,
      masuk: r.masuk,
      // Bertanda: transfer keluar dan opname kurang bernilai negatif.
      transferIn: r.transfer_in,
      transferOut: r.transfer_out,
      opname: r.opname,
      closing,
      status,
    };
  });

  return {
    from: query.from,
    to: query.to,
    branch,
    summary: { rowCount: data.length, lowStock, outOfStock },
    rows: data,
  };
}

type CountRow = {
  branch_id: number;
  direct: boolean;
  transfers: number;
  received_transfers: number;
};

type DetailRow = {
  branch_id: number;
  direct: boolean;
  product_id: number;
  sku: string;
  product_name: string;
  unit: string;
  qty_sent: number;
  qty_received: number;
  shortfall: number;
};

const REQUEST_STATUSES = [
  "DIAJUKAN",
  "DISETUJUI",
  "DITOLAK",
  "DIBATALKAN",
  "DIKIRIM",
  "DITERIMA",
] as const;

/**
 * Laporan Distribusi (bagian 4.8): transfer `DIKIRIM`/`DITERIMA` yang `sent_at`-nya dalam periode
 * (batas hari WIB), direkap per cabang tujuan. Pengiriman langsung (`requested_at` kosong) menjadi
 * baris terpisah per cabang tujuan. Qty diterima dan selisih kirim hanya dihitung dari transfer yang
 * sudah DITERIMA (selisih tidak menjadi pergerakan stok, bagian 4.5). Rekap status pengajuan
 * mencakup transfer dari request menurut `requested_at` dan status saat ini.
 */
export async function distributionReport(query: ReportQuery) {
  const branch = await findBranch(query.branchId);
  const start = jakartaDayStart(query.from);
  const end = jakartaNextDayStart(query.to);
  const branchCond = branch ? Prisma.sql`AND t.to_branch_id = ${branch.id}` : Prisma.empty;

  const [counts, details, statusGroups] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT t.to_branch_id AS branch_id, (t.requested_at IS NULL) AS direct,
             COUNT(*)::int AS transfers,
             COUNT(*) FILTER (WHERE t.status = 'DITERIMA')::int AS received_transfers
      FROM stock_transfers t
      WHERE t.status IN ('DIKIRIM', 'DITERIMA') AND t.sent_at >= ${start} AND t.sent_at < ${end}
        ${branchCond}
      GROUP BY 1, 2`,
    prisma.$queryRaw<DetailRow[]>`
      SELECT t.to_branch_id AS branch_id, (t.requested_at IS NULL) AS direct,
             p.id AS product_id, p.sku, p.name AS product_name, p.unit,
             COALESCE(SUM(ti.qty_sent), 0)::int AS qty_sent,
             COALESCE(SUM(ti.qty_received) FILTER (WHERE t.status = 'DITERIMA'), 0)::int AS qty_received,
             COALESCE(SUM(COALESCE(ti.qty_sent, 0) - COALESCE(ti.qty_received, 0))
                      FILTER (WHERE t.status = 'DITERIMA'), 0)::int AS shortfall
      FROM stock_transfers t
      JOIN stock_transfer_items ti ON ti.transfer_id = t.id
      JOIN products p ON p.id = ti.product_id
      WHERE t.status IN ('DIKIRIM', 'DITERIMA') AND t.sent_at >= ${start} AND t.sent_at < ${end}
        AND COALESCE(ti.qty_sent, 0) > 0 ${branchCond}
      GROUP BY 1, 2, p.id, p.sku, p.name, p.unit
      ORDER BY p.sku ASC`,
    prisma.stockTransfer.groupBy({
      by: ["status"],
      where: {
        requestedAt: { gte: start, lt: end },
        ...(branch ? { toBranchId: branch.id } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const branchIds = [...new Set(counts.map((c) => c.branch_id))];
  const branches = await prisma.branch.findMany({
    where: { id: { in: branchIds } },
    select: branchSelect,
  });
  const branchOf = new Map(branches.map((b) => [b.id, b]));

  const rows = counts
    .map((c) => {
      const items = details
        .filter((d) => d.branch_id === c.branch_id && d.direct === c.direct)
        .map((d) => ({
          product: { id: d.product_id, sku: d.sku, name: d.product_name, unit: d.unit },
          qtySent: d.qty_sent,
          qtyReceived: d.qty_received,
          shortfall: d.shortfall,
        }));
      const sum = (pick: (i: (typeof items)[number]) => number) =>
        items.reduce((total, i) => total + pick(i), 0);
      return {
        branch: branchOf.get(c.branch_id)!,
        origin: c.direct ? ("DIRECT" as const) : ("REQUEST" as const),
        transferCount: c.transfers,
        receivedCount: c.received_transfers,
        qtySent: sum((i) => i.qtySent),
        qtyReceived: sum((i) => i.qtyReceived),
        shortfall: sum((i) => i.shortfall),
        items,
      };
    })
    // Request dulu, lalu pengiriman langsung; di tiap kelompok urut kode cabang.
    .sort(
      (a, b) =>
        Number(a.origin === "DIRECT") - Number(b.origin === "DIRECT") ||
        a.branch.code.localeCompare(b.branch.code),
    );

  const countOf = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const requestStatus = REQUEST_STATUSES.map((status) => ({
    status,
    count: countOf.get(status) ?? 0,
  }));

  return {
    from: query.from,
    to: query.to,
    branch,
    totals: {
      transferCount: rows.reduce((t, r) => t + r.transferCount, 0),
      qtySent: rows.reduce((t, r) => t + r.qtySent, 0),
      qtyReceived: rows.reduce((t, r) => t + r.qtyReceived, 0),
      shortfall: rows.reduce((t, r) => t + r.shortfall, 0),
    },
    rows,
    requestStatus,
    requestTotal: requestStatus.reduce((t, s) => t + s.count, 0),
  };
}
