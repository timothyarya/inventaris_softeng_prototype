import { prisma } from "../../config/prisma";
import { Prisma, type TransferStatus } from "../../generated/prisma/client";
import { generateDocNo } from "../../services/docNumber";
import { applyMovement } from "../../services/stockService";
import { jakartaDayStart, jakartaNextDayStart } from "../../utils/datetime";
import { badRequest, conflict, notFound, unprocessable } from "../../utils/errors";
import { pageMeta, skipTake } from "../../utils/pagination";
import { resolveBranchId } from "../../utils/scope";
import type { AuthUser } from "../auth/service";
import type {
  ApproveInput,
  CreateDirectInput,
  CreateRequestInput,
  ListTransfersQuery,
  ReceiveInput,
  RejectInput,
  SendInput,
} from "./schema";

type Tx = Prisma.TransactionClient;

const branchSelect = { id: true, code: true, name: true, isMain: true } as const;
const userSelect = { id: true, name: true } as const;

const detailInclude = {
  fromBranch: { select: branchSelect },
  toBranch: { select: branchSelect },
  requestedBy: { select: userSelect },
  approvedBy: { select: userSelect },
  sentBy: { select: userSelect },
  receivedBy: { select: userSelect },
  items: {
    orderBy: { id: "asc" },
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true, isActive: true } },
    },
  },
} as const;

type DetailRow = Prisma.StockTransferGetPayload<{ include: typeof detailInclude }>;

const listInclude = {
  fromBranch: { select: branchSelect },
  toBranch: { select: branchSelect },
  items: { select: { qtyRequested: true, qtySent: true, qtyReceived: true } },
} as const;

type ListRow = Prisma.StockTransferGetPayload<{ include: typeof listInclude }>;

const sum = (values: (number | null)[]) => values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
/** Transfer berasal dari request pegawai bila `requested_at` terisi; selain itu pengiriman langsung. */
const originOf = (row: { requestedAt: Date | null }) => (row.requestedAt ? "REQUEST" : "DIRECT");

/** Ringkasan jumlah item dan total qty; dipakai DTO daftar maupun detail. */
function summaryOf(row: {
  status: string;
  items: { qtyRequested: number | null; qtySent: number | null; qtyReceived: number | null }[];
}) {
  const hasSent = row.items.some((i) => i.qtySent !== null);
  const hasRequested = row.items.some((i) => i.qtyRequested !== null);
  return {
    itemCount: row.items.length,
    totalRequested: hasRequested ? sum(row.items.map((i) => i.qtyRequested)) : null,
    totalSent: hasSent ? sum(row.items.map((i) => i.qtySent)) : null,
    totalReceived: row.status === "DITERIMA" ? sum(row.items.map((i) => i.qtyReceived)) : null,
  };
}

function toListDto(row: ListRow) {
  return {
    id: row.id,
    docNo: row.docNo,
    status: row.status,
    origin: originOf(row),
    fromBranch: row.fromBranch,
    toBranch: row.toBranch,
    note: row.note,
    createdAt: row.createdAt,
    requestedAt: row.requestedAt,
    sentAt: row.sentAt,
    receivedAt: row.receivedAt,
    ...summaryOf(row),
  };
}

function toDetailDto(row: DetailRow, warehouseStock?: Map<number, number>) {
  return {
    id: row.id,
    docNo: row.docNo,
    status: row.status,
    origin: originOf(row),
    fromBranch: row.fromBranch,
    toBranch: row.toBranch,
    note: row.note,
    rejectReason: row.rejectReason,
    cancelReason: row.cancelReason,
    // approvedBy/approvedAt juga dipakai untuk keputusan menolak (tidak ada kolom terpisah).
    requestedBy: row.requestedBy,
    approvedBy: row.approvedBy,
    sentBy: row.sentBy,
    receivedBy: row.receivedBy,
    requestedAt: row.requestedAt,
    approvedAt: row.approvedAt,
    sentAt: row.sentAt,
    receivedAt: row.receivedAt,
    createdAt: row.createdAt,
    ...summaryOf(row),
    items: row.items.map((i) => ({
      id: i.id,
      product: i.product,
      qtyRequested: i.qtyRequested,
      qtyApproved: i.qtyApproved,
      qtySent: i.qtySent,
      qtyReceived: i.qtyReceived,
      // Selisih kirim: dikirim - diterima (tidak menjadi movement; bagian 4.5).
      shortfall: i.qtySent !== null && i.qtyReceived !== null ? i.qtySent - i.qtyReceived : null,
      // Hanya untuk Owner/SA saat transfer belum dikirim.
      warehouseStock: warehouseStock ? (warehouseStock.get(i.product.id) ?? 0) : undefined,
    })),
  };
}

const isAdmin = (user: AuthUser) => user.role !== "PEGAWAI";

async function getMainBranch(tx: Tx) {
  const main = await tx.branch.findFirst({
    where: { isMain: true },
    select: { id: true, isActive: true },
  });
  if (!main) throw conflict("Gudang utama belum dikonfigurasi.", "MAIN_BRANCH_MISSING");
  if (!main.isActive) throw conflict("Gudang utama tidak aktif.", "MAIN_BRANCH_INACTIVE");
  return main;
}

/** Produk harus ada dan aktif untuk dokumen baru (bagian 4.3). */
async function assertProductsUsable(tx: Tx, productIds: number[]) {
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sku: true, name: true, isActive: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const id of productIds) {
    const product = byId.get(id);
    if (!product) throw notFound(`Produk dengan id ${id} tidak ditemukan.`);
    if (!product.isActive) {
      throw conflict(
        `Produk ${product.sku} (${product.name}) nonaktif dan tidak dapat dipilih.`,
        "PRODUCT_INACTIVE",
      );
    }
  }
}

/** Kunci baris transfer agar dua aksi bersamaan antre, lalu baca ulang status terkini. */
async function lockTransfer(tx: Tx, id: number, user: AuthUser) {
  await tx.$queryRaw`SELECT id FROM stock_transfers WHERE id = ${id} FOR UPDATE`;
  const row = await tx.stockTransfer.findUnique({ where: { id }, include: detailInclude });
  // Pegawai hanya boleh menyentuh transfer menuju cabangnya; selainnya dianggap tidak ada.
  if (!row || (user.role === "PEGAWAI" && row.toBranchId !== user.branchId)) {
    throw notFound("Transfer tidak ditemukan.");
  }
  return row;
}

function assertStatus(row: DetailRow, allowed: TransferStatus[], verb: string) {
  if (!allowed.includes(row.status)) {
    throw conflict(
      `Transfer ${row.docNo} berstatus ${row.status} sehingga tidak dapat ${verb}.`,
      "INVALID_TRANSITION",
    );
  }
}

/**
 * Qty per item setelah penyesuaian dari client. Item yang tidak disebut memakai nilai default.
 * Id item yang bukan milik transfer ini ditolak.
 */
function resolveQuantities<K extends string>(
  row: DetailRow,
  overrides: ({ itemId: number } & Record<K, number>)[] | undefined,
  key: K,
  defaultOf: (item: DetailRow["items"][number]) => number,
) {
  const result = new Map(row.items.map((i) => [i.id, defaultOf(i)]));
  for (const o of overrides ?? []) {
    if (!result.has(o.itemId)) throw badRequest("Item tidak termasuk dalam transfer ini.");
    result.set(o.itemId, o[key]);
  }
  return result;
}

/**
 * Kurangi stok gudang untuk pengiriman (bagian 4.5). Baris stok dikunci dan dicek lebih dulu
 * sehingga bila ada yang kurang, SELURUH pengiriman ditolak (422) dengan daftar item yang kurang.
 */
async function dispatchFromWarehouse(
  tx: Tx,
  t: { id: number; docNo: string; fromBranchId: number; userId: number },
  lines: { productId: number; qty: number }[],
) {
  const toSend = lines.filter((l) => l.qty > 0).sort((a, b) => a.productId - b.productId);
  if (toSend.length === 0) return;

  const ids = toSend.map((l) => l.productId);
  const stocks = await tx.$queryRaw<{ product_id: number; qty: number }[]>`
    SELECT product_id, qty FROM branch_stocks
    WHERE branch_id = ${t.fromBranchId} AND product_id IN (${Prisma.join(ids)})
    ORDER BY product_id
    FOR UPDATE`;
  const available = new Map(stocks.map((s) => [s.product_id, s.qty]));

  const short = toSend.filter((l) => (available.get(l.productId) ?? 0) < l.qty);
  if (short.length > 0) {
    const products = await tx.product.findMany({
      where: { id: { in: short.map((l) => l.productId) } },
      select: { id: true, sku: true, name: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const detail = short.map((l) => {
      const p = byId.get(l.productId);
      return `${p?.sku} — ${p?.name} (tersedia ${available.get(l.productId) ?? 0}, dibutuhkan ${l.qty})`;
    });
    throw unprocessable(
      `Stok gudang tidak cukup untuk: ${detail.join("; ")}.`,
      "INSUFFICIENT_STOCK",
    );
  }

  for (const line of toSend) {
    await applyMovement(tx, {
      branchId: t.fromBranchId,
      productId: line.productId,
      delta: -line.qty,
      type: "TRANSFER_OUT",
      refType: "TRANSFER",
      refId: t.id,
      refDocNo: t.docNo,
      userId: t.userId,
    });
  }
}

export async function listTransfers(query: ListTransfersQuery, user: AuthUser) {
  // Pegawai: cabang tujuan selalu cabangnya sendiri (bagian 3.3). Admin: filter opsional.
  const toBranchId = resolveBranchId(user, query.branchId);

  const where: Prisma.StockTransferWhereInput = {
    ...(toBranchId !== null ? { toBranchId } : {}),
    ...(query.status ? { status: { in: query.status } } : {}),
    ...(query.origin === "request" ? { requestedAt: { not: null } } : {}),
    ...(query.origin === "direct" ? { requestedAt: null } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: jakartaDayStart(query.from) } : {}),
            ...(query.to ? { lt: jakartaNextDayStart(query.to) } : {}),
          },
        }
      : {}),
    ...(query.q
      ? {
          OR: [
            { docNo: { contains: query.q, mode: "insensitive" } },
            { toBranch: { name: { contains: query.q, mode: "insensitive" } } },
            { toBranch: { code: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.stockTransfer.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: listInclude,
      ...skipTake(query),
    }),
    prisma.stockTransfer.count({ where }),
  ]);
  return { data: rows.map(toListDto), meta: pageMeta(query, total) };
}

export async function getTransfer(id: number, user: AuthUser) {
  const row = await prisma.stockTransfer.findUnique({ where: { id }, include: detailInclude });
  if (!row || (user.role === "PEGAWAI" && row.toBranchId !== user.branchId)) {
    throw notFound("Transfer tidak ditemukan.");
  }

  // Owner/SA melihat stok gudang saat memutuskan setujui/kirim.
  let warehouseStock: Map<number, number> | undefined;
  if (isAdmin(user) && (row.status === "DIAJUKAN" || row.status === "DISETUJUI")) {
    const stocks = await prisma.branchStock.findMany({
      where: { branchId: row.fromBranchId, productId: { in: row.items.map((i) => i.product.id) } },
      select: { productId: true, qty: true },
    });
    warehouseStock = new Map(stocks.map((s) => [s.productId, s.qty]));
  }
  return toDetailDto(row, warehouseStock);
}

/** Request dari pegawai untuk cabangnya (status DIAJUKAN). Stok belum berubah. */
export async function createRequest(input: CreateRequestInput, user: AuthUser) {
  const id = await prisma.$transaction(async (tx) => {
    const toBranchId = user.branchId;
    if (toBranchId === null) throw conflict("Anda belum ditugaskan ke cabang.", "NO_BRANCH");
    const branch = await tx.branch.findUnique({
      where: { id: toBranchId },
      select: { isActive: true, isMain: true },
    });
    if (!branch || !branch.isActive) throw conflict("Cabang Anda tidak aktif.", "BRANCH_INACTIVE");
    if (branch.isMain) {
      throw conflict("Gudang utama tidak dapat meminta stok.", "MAIN_BRANCH_NOT_DESTINATION");
    }
    const main = await getMainBranch(tx);
    await assertProductsUsable(
      tx,
      input.items.map((i) => i.productId),
    );

    const docNo = await generateDocNo(tx, "TR");
    const created = await tx.stockTransfer.create({
      data: {
        docNo,
        fromBranchId: main.id,
        toBranchId,
        status: "DIAJUKAN",
        note: input.note ?? null,
        requestedById: user.id,
        requestedAt: new Date(),
        items: {
          create: input.items.map((i) => ({ productId: i.productId, qtyRequested: i.qty })),
        },
      },
      select: { id: true },
    });
    return created.id;
  });
  return getTransfer(id, user);
}

/** Pengiriman langsung Owner/SA: dibuat langsung DIKIRIM, stok gudang berkurang seketika. */
export async function createDirect(input: CreateDirectInput, user: AuthUser) {
  const id = await prisma.$transaction(async (tx) => {
    const dest = await tx.branch.findUnique({
      where: { id: input.toBranchId },
      select: { id: true, code: true, isActive: true, isMain: true },
    });
    if (!dest) throw notFound("Cabang tujuan tidak ditemukan.");
    if (dest.isMain) {
      throw conflict("Tujuan harus cabang, bukan gudang utama.", "MAIN_BRANCH_NOT_DESTINATION");
    }
    if (!dest.isActive) {
      throw conflict(`Cabang ${dest.code} tidak aktif.`, "BRANCH_INACTIVE");
    }
    const main = await getMainBranch(tx);
    await assertProductsUsable(
      tx,
      input.items.map((i) => i.productId),
    );

    const docNo = await generateDocNo(tx, "TR");
    const created = await tx.stockTransfer.create({
      data: {
        docNo,
        fromBranchId: main.id,
        toBranchId: dest.id,
        status: "DIKIRIM",
        note: input.note ?? null,
        sentById: user.id,
        sentAt: new Date(),
        // Tanpa tahap pengajuan: qty_requested dan qty_approved tetap null (bagian 14).
        items: { create: input.items.map((i) => ({ productId: i.productId, qtySent: i.qty })) },
      },
      select: { id: true },
    });
    await dispatchFromWarehouse(
      tx,
      { id: created.id, docNo, fromBranchId: main.id, userId: user.id },
      input.items,
    );
    return created.id;
  });
  return getTransfer(id, user);
}

/** Pegawai membatalkan request milik cabangnya yang masih DIAJUKAN. */
export async function cancelTransfer(id: number, user: AuthUser) {
  await prisma.$transaction(async (tx) => {
    const row = await lockTransfer(tx, id, user);
    assertStatus(row, ["DIAJUKAN"], "dibatalkan");
    await tx.stockTransfer.update({ where: { id }, data: { status: "DIBATALKAN" } });
  });
  return getTransfer(id, user);
}

/** Owner/SA menolak request; alasan wajib. Stok tidak berubah. */
export async function rejectTransfer(id: number, input: RejectInput, user: AuthUser) {
  await prisma.$transaction(async (tx) => {
    const row = await lockTransfer(tx, id, user);
    assertStatus(row, ["DIAJUKAN"], "ditolak");
    await tx.stockTransfer.update({
      where: { id },
      data: {
        status: "DITOLAK",
        rejectReason: input.reason,
        approvedById: user.id,
        approvedAt: new Date(),
      },
    });
  });
  return getTransfer(id, user);
}

/** Owner/SA menyetujui dan boleh menyesuaikan qty yang akan dikirim. Stok belum berubah. */
export async function approveTransfer(id: number, input: ApproveInput, user: AuthUser) {
  await prisma.$transaction(async (tx) => {
    const row = await lockTransfer(tx, id, user);
    assertStatus(row, ["DIAJUKAN"], "disetujui");

    const qty = resolveQuantities(row, input.items, "qtyApproved", (i) => i.qtyRequested ?? 0);
    if (![...qty.values()].some((v) => v > 0)) {
      throw badRequest(
        "Minimal satu item harus disetujui lebih dari 0. Gunakan Tolak bila permintaan tidak dapat dipenuhi.",
      );
    }
    for (const [itemId, qtyApproved] of qty) {
      await tx.stockTransferItem.update({ where: { id: itemId }, data: { qtyApproved } });
    }
    await tx.stockTransfer.update({
      where: { id },
      data: { status: "DISETUJUI", approvedById: user.id, approvedAt: new Date() },
    });
  });
  return getTransfer(id, user);
}

/** Owner/SA mengirim transfer DISETUJUI: stok gudang berkurang dalam transaksi yang sama. */
export async function sendTransfer(id: number, input: SendInput, user: AuthUser) {
  await prisma.$transaction(async (tx) => {
    const row = await lockTransfer(tx, id, user);
    assertStatus(row, ["DISETUJUI"], "dikirim");

    // Default form kirim = qty disetujui; boleh diubah (bagian 14).
    const qty = resolveQuantities(row, input.items, "qtySent", (i) => i.qtyApproved ?? 0);
    if (![...qty.values()].some((v) => v > 0)) {
      throw badRequest("Minimal satu item harus dikirim lebih dari 0.");
    }
    for (const [itemId, qtySent] of qty) {
      await tx.stockTransferItem.update({ where: { id: itemId }, data: { qtySent } });
    }
    await tx.stockTransfer.update({
      where: { id },
      data: { status: "DIKIRIM", sentById: user.id, sentAt: new Date() },
    });
    await dispatchFromWarehouse(
      tx,
      { id, docNo: row.docNo, fromBranchId: row.fromBranchId, userId: user.id },
      row.items.map((i) => ({ productId: i.product.id, qty: qty.get(i.id) ?? 0 })),
    );
  });
  return getTransfer(id, user);
}

/** Pegawai cabang tujuan menerima kiriman: stok cabang bertambah sebesar qty diterima. */
export async function receiveTransfer(id: number, input: ReceiveInput, user: AuthUser) {
  await prisma.$transaction(async (tx) => {
    const row = await lockTransfer(tx, id, user);
    assertStatus(row, ["DIKIRIM"], "diterima");

    const qty = resolveQuantities(row, input.items, "qtyReceived", (i) => i.qtySent ?? 0);
    for (const item of row.items) {
      const received = qty.get(item.id) ?? 0;
      const sent = item.qtySent ?? 0;
      if (received > sent) {
        throw badRequest(
          `Qty diterima ${item.product.sku} (${received}) melebihi qty dikirim (${sent}).`,
        );
      }
    }
    for (const [itemId, qtyReceived] of qty) {
      await tx.stockTransferItem.update({ where: { id: itemId }, data: { qtyReceived } });
    }
    await tx.stockTransfer.update({
      where: { id },
      data: { status: "DITERIMA", receivedById: user.id, receivedAt: new Date() },
    });

    // Selisih kirim tidak menjadi movement; item dengan qty diterima 0 tidak membuat movement.
    const lines = row.items
      .map((i) => ({ productId: i.product.id, qty: qty.get(i.id) ?? 0 }))
      .filter((l) => l.qty > 0)
      .sort((a, b) => a.productId - b.productId);
    for (const line of lines) {
      await applyMovement(tx, {
        branchId: row.toBranchId,
        productId: line.productId,
        delta: line.qty,
        type: "TRANSFER_IN",
        refType: "TRANSFER",
        refId: id,
        refDocNo: row.docNo,
        userId: user.id,
      });
    }
  });
  return getTransfer(id, user);
}
