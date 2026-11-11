import { prisma } from "../../config/prisma";
import type { Prisma } from "../../generated/prisma/client";
import { generateDocNo } from "../../services/docNumber";
import { applyMovement } from "../../services/stockService";
import { dateOnly } from "../../utils/datetime";
import { conflict, notFound } from "../../utils/errors";
import { pageMeta, skipTake } from "../../utils/pagination";
import type { CreateStockInInput, ListStockInsQuery } from "./schema";

const dateToString = (d: Date) => d.toISOString().slice(0, 10);

const listInclude = {
  createdBy: { select: { id: true, name: true } },
  items: { select: { qty: true } },
} as const;

type ListRow = Prisma.StockInGetPayload<{ include: typeof listInclude }>;

function toListDto(row: ListRow) {
  return {
    id: row.id,
    docNo: row.docNo,
    date: dateToString(row.date),
    supplierName: row.supplierName,
    invoiceNo: row.invoiceNo,
    note: row.note,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    itemCount: row.items.length,
    totalQty: row.items.reduce((sum, i) => sum + i.qty, 0),
  };
}

export async function listStockIns(query: ListStockInsQuery) {
  const where: Prisma.StockInWhereInput = {
    ...(query.from || query.to
      ? {
          date: {
            ...(query.from ? { gte: dateOnly(query.from) } : {}),
            ...(query.to ? { lte: dateOnly(query.to) } : {}),
          },
        }
      : {}),
    ...(query.q
      ? {
          OR: [
            { docNo: { contains: query.q, mode: "insensitive" } },
            { supplierName: { contains: query.q, mode: "insensitive" } },
            { invoiceNo: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.stockIn.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: listInclude,
      ...skipTake(query),
    }),
    prisma.stockIn.count({ where }),
  ]);
  return { data: rows.map(toListDto), meta: pageMeta(query, total) };
}

export async function getStockIn(id: number) {
  const row = await prisma.stockIn.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      items: {
        orderBy: { id: "asc" },
        include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
      },
    },
  });
  if (!row) throw notFound("Stok masuk tidak ditemukan.");

  return {
    id: row.id,
    docNo: row.docNo,
    date: dateToString(row.date),
    supplierName: row.supplierName,
    invoiceNo: row.invoiceNo,
    note: row.note,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    itemCount: row.items.length,
    totalQty: row.items.reduce((sum, i) => sum + i.qty, 0),
    items: row.items.map((i) => ({ id: i.id, qty: i.qty, product: i.product })),
  };
}

/**
 * Stok masuk dari supplier selalu ke gudang utama (bagian 4.4). Dokumen, item, perubahan
 * stok, dan movement ditulis dalam satu transaksi: gagal di mana pun berarti rollback total
 * (termasuk nomor dokumen).
 */
export async function createStockIn(input: CreateStockInInput, userId: number) {
  const id = await prisma.$transaction(async (tx) => {
    const main = await tx.branch.findFirst({
      where: { isMain: true },
      select: { id: true, isActive: true },
    });
    if (!main) throw conflict("Gudang utama belum dikonfigurasi.", "MAIN_BRANCH_MISSING");
    if (!main.isActive) throw conflict("Gudang utama tidak aktif.", "MAIN_BRANCH_INACTIVE");

    // Urut berdasarkan productId: urutan penguncian baris stok konsisten (anti-deadlock).
    const items = [...input.items].sort((a, b) => a.productId - b.productId);

    const products = await tx.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      select: { id: true, sku: true, name: true, isActive: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product) throw notFound(`Produk dengan id ${item.productId} tidak ditemukan.`);
      if (!product.isActive) {
        throw conflict(
          `Produk ${product.sku} (${product.name}) nonaktif dan tidak dapat dipilih.`,
          "PRODUCT_INACTIVE",
        );
      }
    }

    const docNo = await generateDocNo(tx, "SI");
    const stockIn = await tx.stockIn.create({
      data: {
        docNo,
        date: dateOnly(input.date),
        supplierName: input.supplierName,
        invoiceNo: input.invoiceNo ?? null,
        note: input.note ?? null,
        createdById: userId,
        items: { create: items.map((i) => ({ productId: i.productId, qty: i.qty })) },
      },
      select: { id: true },
    });

    for (const item of items) {
      await applyMovement(tx, {
        branchId: main.id,
        productId: item.productId,
        delta: item.qty,
        type: "MASUK",
        refType: "STOCK_IN",
        refId: stockIn.id,
        refDocNo: docNo,
        userId,
      });
    }
    return stockIn.id;
  });

  return getStockIn(id);
}
