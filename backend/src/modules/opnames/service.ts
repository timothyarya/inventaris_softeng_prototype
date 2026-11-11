import { prisma } from "../../config/prisma";
import { Prisma, type OpnameStatus } from "../../generated/prisma/client";
import { generateDocNo } from "../../services/docNumber";
import { applyMovement } from "../../services/stockService";
import { dateOnly } from "../../utils/datetime";
import { AppError, badRequest, conflict, notFound } from "../../utils/errors";
import { pageMeta, skipTake } from "../../utils/pagination";
import { resolveBranchId } from "../../utils/scope";
import type { AuthUser } from "../auth/service";
import type {
  ApproveInput,
  CreateOpnameInput,
  ListOpnamesQuery,
  PrefillQuery,
  RejectInput,
} from "./schema";
import { verifierRolesFor } from "./verifyRules";

type Tx = Prisma.TransactionClient;

const dateToString = (d: Date) => d.toISOString().slice(0, 10);

const branchSelect = { id: true, code: true, name: true, isMain: true } as const;
const userSelect = { id: true, name: true, role: true } as const;

const detailInclude = {
  branch: { select: branchSelect },
  createdBy: { select: userSelect },
  verifiedBy: { select: userSelect },
  items: {
    orderBy: { id: "asc" },
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true, isActive: true } },
    },
  },
} as const;

type DetailRow = Prisma.StockOpnameGetPayload<{ include: typeof detailInclude }>;

const listInclude = {
  branch: { select: branchSelect },
  createdBy: { select: userSelect },
  verifiedBy: { select: userSelect },
  items: { select: { difference: true } },
} as const;

type ListRow = Prisma.StockOpnameGetPayload<{ include: typeof listInclude }>;

/** Ringkasan item; dipakai DTO daftar maupun detail. */
function summaryOf(items: { difference: number }[]) {
  return {
    itemCount: items.length,
    diffItemCount: items.filter((i) => i.difference !== 0).length,
    totalDifference: items.reduce((acc, i) => acc + i.difference, 0),
  };
}

function toListDto(row: ListRow) {
  return {
    id: row.id,
    docNo: row.docNo,
    branch: row.branch,
    date: dateToString(row.date),
    status: row.status,
    note: row.note,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    verifiedBy: row.verifiedBy,
    verifiedAt: row.verifiedAt,
    ...summaryOf(row.items),
  };
}

/** Apakah `user` boleh menyetujui/menolak opname ini (menurut role pembuat saat ini). */
function canVerify(row: DetailRow, user: AuthUser) {
  return row.status === "MENUNGGU" && verifierRolesFor(row.createdBy.role).includes(user.role);
}

function toDetailDto(row: DetailRow, user: AuthUser) {
  return {
    id: row.id,
    docNo: row.docNo,
    branch: row.branch,
    date: dateToString(row.date),
    status: row.status,
    note: row.note,
    verifyNote: row.verifyNote,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    verifiedBy: row.verifiedBy,
    verifiedAt: row.verifiedAt,
    // Siapa saja yang berhak memverifikasi, agar UI dapat menjelaskan bila tombol disembunyikan.
    verifierRoles: verifierRolesFor(row.createdBy.role),
    canVerify: canVerify(row, user),
    ...summaryOf(row.items),
    items: row.items.map((i) => ({
      id: i.id,
      product: i.product,
      qtySystem: i.qtySystem,
      qtyPhysical: i.qtyPhysical,
      difference: i.difference,
      remark: i.remark,
    })),
  };
}

/** Cabang harus ada dan aktif untuk opname baru. */
async function assertBranchUsable(tx: Pick<Tx, "branch">, branchId: number) {
  const branch = await tx.branch.findUnique({
    where: { id: branchId },
    select: { id: true, code: true, name: true, isMain: true, isActive: true },
  });
  if (!branch) throw notFound("Cabang tidak ditemukan.");
  if (!branch.isActive) {
    throw conflict(`Cabang ${branch.code} tidak aktif.`, "BRANCH_INACTIVE");
  }
  return branch;
}

/** Pegawai Cabang tanpa cabang tidak dapat membuat opname; admin wajib memilih cabang. */
function requireBranchId(user: AuthUser, requested?: number | null) {
  const branchId = resolveBranchId(user, requested);
  if (branchId === null) throw badRequest("Cabang wajib dipilih.");
  return branchId;
}

/** Kunci baris opname agar dua aksi bersamaan antre, lalu baca ulang status terkini. */
async function lockOpname(tx: Tx, id: number, user: AuthUser) {
  await tx.$queryRaw`SELECT id FROM stock_opnames WHERE id = ${id} FOR UPDATE`;
  const row = await tx.stockOpname.findUnique({ where: { id }, include: detailInclude });
  // Pegawai Cabang hanya boleh menyentuh opname cabangnya; selainnya dianggap tidak ada.
  if (!row || (user.role === "PEGAWAI_CABANG" && row.branchId !== user.branchId)) {
    throw notFound("Opname tidak ditemukan.");
  }
  return row;
}

function assertPending(row: DetailRow, verb: string) {
  const allowed: OpnameStatus[] = ["MENUNGGU"];
  if (!allowed.includes(row.status)) {
    throw conflict(
      `Opname ${row.docNo} berstatus ${row.status} sehingga tidak dapat ${verb}.`,
      "INVALID_TRANSITION",
    );
  }
}

/** Aturan siapa yang boleh memverifikasi bergantung pada role pembuat (Fase 5). */
function assertCanVerify(row: DetailRow, user: AuthUser) {
  if (!verifierRolesFor(row.createdBy.role).includes(user.role)) {
    const who = row.createdBy.role === "PEGAWAI_CABANG" ? "Admin Gudang atau Owner" : "Owner";
    throw new AppError(
      403,
      "OPNAME_APPROVER_NOT_ALLOWED",
      `Opname ${row.docNo} dibuat oleh ${row.createdBy.name} sehingga hanya ${who} yang dapat memverifikasinya.`,
    );
  }
}

/** Produk aktif beserta stok terkini di satu cabang (urut SKU). */
async function activeProductsWithStock(branchId: number) {
  const [products, stocks] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { sku: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        category: { select: { id: true, name: true } },
      },
    }),
    prisma.branchStock.findMany({ where: { branchId }, select: { productId: true, qty: true } }),
  ]);
  const qtyOf = new Map(stocks.map((s) => [s.productId, s.qty]));
  return products.map((p) => ({ product: p, qtySystem: qtyOf.get(p.id) ?? 0 }));
}

/** Daftar produk aktif + qty_sistem untuk formulir hitung fisik. */
export async function prefill(query: PrefillQuery, user: AuthUser) {
  const branchId = requireBranchId(user, query.branchId);
  const branch = await assertBranchUsable(prisma, branchId);
  const [items, pending] = await Promise.all([
    activeProductsWithStock(branchId),
    prisma.stockOpname.findFirst({
      where: { branchId, status: "MENUNGGU" },
      select: { id: true, docNo: true },
    }),
  ]);
  return {
    branch: { id: branch.id, code: branch.code, name: branch.name, isMain: branch.isMain },
    pendingOpname: pending,
    items,
  };
}

export async function listOpnames(query: ListOpnamesQuery, user: AuthUser) {
  // Pegawai Cabang: cabang selalu cabangnya sendiri (bagian 3.3). Admin: filter opsional.
  const branchId = resolveBranchId(user, query.branchId);

  const where: Prisma.StockOpnameWhereInput = {
    ...(branchId !== null ? { branchId } : {}),
    ...(query.status ? { status: { in: query.status } } : {}),
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
            { branch: { name: { contains: query.q, mode: "insensitive" } } },
            { branch: { code: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.stockOpname.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: listInclude,
      ...skipTake(query),
    }),
    prisma.stockOpname.count({ where }),
  ]);
  return { data: rows.map(toListDto), meta: pageMeta(query, total) };
}

export async function getOpname(id: number, user: AuthUser) {
  const row = await prisma.stockOpname.findUnique({ where: { id }, include: detailInclude });
  if (!row || (user.role === "PEGAWAI_CABANG" && row.branchId !== user.branchId)) {
    throw notFound("Opname tidak ditemukan.");
  }
  return toDetailDto(row, user);
}

/**
 * Buat opname (status MENUNGGU). qty_sistem dibaca server pada saat simpan, bukan dari client.
 * Stok belum berubah sampai opname disetujui.
 */
export async function createOpname(input: CreateOpnameInput, user: AuthUser) {
  const branchId = requireBranchId(user, input.branchId);

  const id = await prisma.$transaction(async (tx) => {
    // Kunci baris cabang lebih dulu: pembuatan bersamaan dan penonaktifan cabang saling antre
    // (penonaktifan memakai kunci yang sama); sisanya dijaga indeks unik parsial.
    await tx.$queryRaw`SELECT id FROM branches WHERE id = ${branchId} FOR UPDATE`;
    const branch = await assertBranchUsable(tx, branchId);
    const pending = await tx.stockOpname.findFirst({
      where: { branchId, status: "MENUNGGU" },
      select: { docNo: true },
    });
    if (pending) {
      throw conflict(
        `Cabang ${branch.code} masih memiliki opname yang menunggu verifikasi (${pending.docNo}). Selesaikan atau tunggu keputusannya terlebih dahulu.`,
        "OPNAME_PENDING_EXISTS",
      );
    }

    const productIds = input.items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sku: true, name: true, isActive: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const pid of productIds) {
      const product = byId.get(pid);
      if (!product) throw notFound(`Produk dengan id ${pid} tidak ditemukan.`);
      if (!product.isActive) {
        throw conflict(
          `Produk ${product.sku} (${product.name}) nonaktif dan tidak dapat dihitung.`,
          "PRODUCT_INACTIVE",
        );
      }
    }

    const stocks = await tx.branchStock.findMany({
      where: { branchId, productId: { in: productIds } },
      select: { productId: true, qty: true },
    });
    const qtyOf = new Map(stocks.map((s) => [s.productId, s.qty]));

    const docNo = await generateDocNo(tx, "OP");
    const created = await tx.stockOpname.create({
      data: {
        docNo,
        branchId,
        date: dateOnly(input.date),
        status: "MENUNGGU",
        note: input.note ?? null,
        createdById: user.id,
        items: {
          create: input.items.map((i) => {
            const qtySystem = qtyOf.get(i.productId) ?? 0;
            return {
              productId: i.productId,
              qtySystem,
              qtyPhysical: i.qtyPhysical,
              difference: i.qtyPhysical - qtySystem,
              remark: i.remark ?? null,
            };
          }),
        },
      },
      select: { id: true },
    });
    return created.id;
  });
  return getOpname(id, user);
}

/**
 * Setujui: selisih tiap item (bukan nilai fisik) diterapkan ke stok SAAT INI lewat stockService,
 * dalam satu transaksi. Bila stok akan menjadi negatif, seluruh persetujuan dibatalkan (422).
 */
export async function approveOpname(id: number, input: ApproveInput, user: AuthUser) {
  await prisma.$transaction(async (tx) => {
    const row = await lockOpname(tx, id, user);
    assertPending(row, "disetujui");
    assertCanVerify(row, user);

    await tx.stockOpname.update({
      where: { id },
      data: {
        status: "DISETUJUI",
        verifiedById: user.id,
        verifiedAt: new Date(),
        verifyNote: input.verifyNote ?? null,
      },
    });

    // Urut productId agar urutan penguncian konsisten (anti-deadlock).
    const lines = row.items
      .filter((i) => i.difference !== 0)
      .sort((a, b) => a.product.id - b.product.id);
    for (const line of lines) {
      try {
        await applyMovement(tx, {
          branchId: row.branchId,
          productId: line.product.id,
          delta: line.difference,
          type: "OPNAME",
          refType: "OPNAME",
          refId: id,
          refDocNo: row.docNo,
          userId: user.id,
        });
      } catch (e) {
        if (e instanceof AppError && e.code === "INSUFFICIENT_STOCK") {
          throw new AppError(
            e.status,
            e.code,
            `Opname tidak dapat disetujui: stok ${line.product.sku} — ${line.product.name} sudah berubah sejak dihitung. ${e.message}`,
          );
        }
        throw e;
      }
    }
  });
  return getOpname(id, user);
}

/** Tolak: catatan wajib, stok tidak berubah. Pegawai dapat membuat opname baru sesudahnya. */
export async function rejectOpname(id: number, input: RejectInput, user: AuthUser) {
  await prisma.$transaction(async (tx) => {
    const row = await lockOpname(tx, id, user);
    assertPending(row, "ditolak");
    assertCanVerify(row, user);
    await tx.stockOpname.update({
      where: { id },
      data: {
        status: "DITOLAK",
        verifiedById: user.id,
        verifiedAt: new Date(),
        verifyNote: input.verifyNote,
      },
    });
  });
  return getOpname(id, user);
}
