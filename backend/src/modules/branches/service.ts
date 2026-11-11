import { prisma } from "../../config/prisma";
import type { Prisma } from "../../generated/prisma/client";
import { conflict, notFound } from "../../utils/errors";
import { pageMeta, skipTake } from "../../utils/pagination";
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from "./schema";

type BranchRow = Prisma.BranchGetPayload<{ include: { _count: { select: { users: true } } } }>;

const withUserCount = { _count: { select: { users: true } } } as const;

function toDto(b: BranchRow) {
  return {
    id: b.id,
    code: b.code,
    name: b.name,
    address: b.address,
    phone: b.phone,
    isMain: b.isMain,
    isActive: b.isActive,
    userCount: b._count.users,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

export async function listBranches(query: ListBranchesQuery) {
  const where: Prisma.BranchWhereInput = {
    ...(query.active === undefined ? {} : { isActive: query.active }),
    ...(query.q
      ? {
          OR: [
            { code: { contains: query.q, mode: "insensitive" } },
            { name: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.branch.findMany({
      where,
      orderBy: [{ isMain: "desc" }, { code: "asc" }],
      include: withUserCount,
      ...skipTake(query),
    }),
    prisma.branch.count({ where }),
  ]);
  return { data: rows.map(toDto), meta: pageMeta(query, total) };
}

/** Ringkasan stok cabang. Produk tanpa baris branch_stocks dianggap qty 0 (bagian 14). */
async function stockSummary(branchId: number) {
  const [products, stocks] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, minStock: true } }),
    prisma.branchStock.findMany({ where: { branchId }, select: { productId: true, qty: true } }),
  ]);
  const qtyByProduct = new Map(stocks.map((s) => [s.productId, s.qty]));
  const lowStock = products.filter(
    (p) => p.minStock > 0 && (qtyByProduct.get(p.id) ?? 0) < p.minStock,
  ).length;
  return {
    activeProducts: products.length,
    productsInStock: stocks.filter((s) => s.qty > 0).length,
    totalQty: stocks.reduce((sum, s) => sum + s.qty, 0),
    lowStock,
  };
}

export async function getBranch(id: number) {
  const branch = await prisma.branch.findUnique({ where: { id }, include: withUserCount });
  if (!branch) throw notFound("Cabang tidak ditemukan.");

  const [users, stock] = await Promise.all([
    prisma.user.findMany({
      where: { branchId: id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, isActive: true },
    }),
    stockSummary(id),
  ]);
  return { ...toDto(branch), users, stockSummary: stock };
}

export async function createBranch(input: CreateBranchInput) {
  const dup = await prisma.branch.findUnique({ where: { code: input.code }, select: { id: true } });
  if (dup) throw conflict(`Kode cabang "${input.code}" sudah dipakai.`, "BRANCH_CODE_DUPLICATE");

  // Gudang utama hanya dibuat lewat seed; cabang baru selalu non-main (bagian 4.1).
  const created = await prisma.branch.create({
    data: {
      code: input.code,
      name: input.name,
      address: input.address,
      phone: input.phone,
      isMain: false,
      isActive: true,
    },
    include: withUserCount,
  });
  return toDto(created);
}

export async function updateBranch(id: number, input: UpdateBranchInput) {
  const existing = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("Cabang tidak ditemukan.");
  const updated = await prisma.branch.update({
    where: { id },
    data: { name: input.name, address: input.address, phone: input.phone },
    include: withUserCount,
  });
  return toDto(updated);
}

/**
 * Bagian 4.1 + keputusan 14. Dalam SATU transaksi:
 *  1. cabang menjadi nonaktif
 *  2. semua pegawainya branch_id = NULL
 *  3. request transfer DIAJUKAN ke cabang ini -> DIBATALKAN ("Cabang dinonaktifkan")
 *  4. opname MENUNGGU di cabang ini -> DITOLAK (verify_note "Cabang dinonaktifkan",
 *     verified_by = user yang menonaktifkan)
 * Ditolak (409) bila gudang utama, sudah nonaktif, atau masih ada transfer DISETUJUI/DIKIRIM ke cabang ini.
 */
export async function deactivateBranch(id: number, actorId: number) {
  return prisma.$transaction(async (tx) => {
    // Kunci baris cabang agar tidak bersaing dengan proses lain yang membaca status cabang.
    await tx.$queryRaw`SELECT id FROM branches WHERE id = ${id} FOR UPDATE`;

    const branch = await tx.branch.findUnique({ where: { id } });
    if (!branch) throw notFound("Cabang tidak ditemukan.");
    if (branch.isMain) {
      throw conflict("Gudang utama tidak dapat dinonaktifkan.", "MAIN_BRANCH_PROTECTED");
    }
    if (!branch.isActive) throw conflict("Cabang sudah nonaktif.", "BRANCH_STATE_UNCHANGED");

    const blocking = await tx.stockTransfer.count({
      where: { toBranchId: id, status: { in: ["DISETUJUI", "DIKIRIM"] } },
    });
    if (blocking > 0) {
      throw conflict(
        `Cabang tidak dapat dinonaktifkan karena masih ada ${blocking} transfer berstatus DISETUJUI atau DIKIRIM ke cabang ini. Selesaikan atau tunggu transfer tersebut terlebih dahulu.`,
        "BRANCH_HAS_OPEN_TRANSFERS",
      );
    }

    await tx.branch.update({ where: { id }, data: { isActive: false } });

    const released = await tx.user.updateMany({
      where: { branchId: id },
      data: { branchId: null },
    });
    const cancelled = await tx.stockTransfer.updateMany({
      where: { toBranchId: id, status: "DIAJUKAN" },
      data: { status: "DIBATALKAN", cancelReason: "Cabang dinonaktifkan" },
    });
    const rejected = await tx.stockOpname.updateMany({
      where: { branchId: id, status: "MENUNGGU" },
      data: {
        status: "DITOLAK",
        verifyNote: "Cabang dinonaktifkan",
        verifiedById: actorId,
        verifiedAt: new Date(),
      },
    });

    const updated = await tx.branch.findUniqueOrThrow({ where: { id }, include: withUserCount });
    return {
      ...toDto(updated),
      effects: {
        usersReleased: released.count,
        transfersCancelled: cancelled.count,
        opnamesRejected: rejected.count,
      },
    };
  });
}

export async function activateBranch(id: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM branches WHERE id = ${id} FOR UPDATE`;
    const branch = await tx.branch.findUnique({ where: { id }, select: { isActive: true } });
    if (!branch) throw notFound("Cabang tidak ditemukan.");
    if (branch.isActive) throw conflict("Cabang sudah aktif.", "BRANCH_STATE_UNCHANGED");

    // Pegawai Cabang tidak otomatis kembali ke cabang ini (bagian 4.1).
    const updated = await tx.branch.update({
      where: { id },
      data: { isActive: true },
      include: withUserCount,
    });
    return toDto(updated);
  });
}
