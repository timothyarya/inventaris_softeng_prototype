import { prisma } from "../../config/prisma";
import type { Prisma } from "../../generated/prisma/client";
import { badRequest, conflict, notFound } from "../../utils/errors";
import { pageMeta, skipTake } from "../../utils/pagination";
import { hashPassword } from "../../utils/password";
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from "./schema";

// Kolom password TIDAK PERNAH dikirim ke client.
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  branchId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, code: true, name: true, isMain: true } },
} as const;

/** Pasangan (cabang, role) harus valid. Dipakai juga oleh transaksi lain lewat `tx`. */
async function assertAssignableBranch(tx: Prisma.TransactionClient, branchId: number) {
  const branch = await tx.branch.findUnique({
    where: { id: branchId },
    select: { isMain: true, isActive: true },
  });
  if (!branch) throw notFound("Cabang tidak ditemukan.", "BRANCH_NOT_FOUND");
  if (branch.isMain) {
    throw conflict("Gudang utama tidak boleh memiliki pegawai.", "MAIN_BRANCH_NO_STAFF");
  }
  if (!branch.isActive) {
    throw conflict("Cabang nonaktif tidak dapat dipilih untuk penugasan.", "BRANCH_INACTIVE");
  }
}

/** Mengunci semua Owner aktif agar pemeriksaan "minimal 1 Owner aktif" aman dari balapan. */
async function lockActiveOwners(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT id FROM users WHERE role = 'OWNER' AND is_active = true FOR UPDATE`;
}

const countOtherActiveOwners = (tx: Prisma.TransactionClient, exceptId: number) =>
  tx.user.count({ where: { role: "OWNER", isActive: true, NOT: { id: exceptId } } });

async function assertEmailFree(tx: Prisma.TransactionClient, email: string, exceptId?: number) {
  const dup = await tx.user.findFirst({
    where: { email, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw conflict(`Email "${email}" sudah dipakai user lain.`, "EMAIL_DUPLICATE");
}

export async function listUsers(query: ListUsersQuery) {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.branchId === "none"
      ? { branchId: null }
      : query.branchId !== undefined
        ? { branchId: query.branchId }
        : {}),
    ...(query.status === "active" ? { isActive: true } : {}),
    ...(query.status === "inactive" ? { isActive: false } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: userSelect,
      ...skipTake(query),
    }),
    prisma.user.count({ where }),
  ]);
  return { data: rows, meta: pageMeta(query, total) };
}

export async function getUser(id: number) {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw notFound("User tidak ditemukan.");
  return user;
}

export async function createUser(input: CreateUserInput) {
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    await assertEmailFree(tx, input.email);
    if (input.branchId !== null) await assertAssignableBranch(tx, input.branchId);
    return tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: passwordHash,
        role: input.role,
        branchId: input.branchId,
      },
      select: userSelect,
    });
  });
}

/**
 * Edit user, assign/pindah cabang, ubah role, dan reset password (bagian 4.2 + keputusan 14).
 * - Role Owner/SuperAdmin: branch_id dikosongkan otomatis.
 * - Role Pegawai: cabang boleh kosong; bila diisi harus cabang aktif dan bukan gudang utama.
 * - Owner aktif terakhir tidak boleh diturunkan role-nya.
 */
export async function updateUser(id: number, input: UpdateUserInput) {
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;

  return prisma.$transaction(async (tx) => {
    await lockActiveOwners(tx);

    const user = await tx.user.findUnique({ where: { id } });
    if (!user) throw notFound("User tidak ditemukan.");

    const finalRole = input.role ?? user.role;
    let finalBranchId: number | null;
    if (finalRole === "PEGAWAI") {
      finalBranchId = input.branchId !== undefined ? input.branchId : user.branchId;
      if (finalBranchId !== null && finalBranchId !== user.branchId) {
        await assertAssignableBranch(tx, finalBranchId);
      }
    } else {
      if (input.branchId != null) {
        throw badRequest("Owner/SuperAdmin tidak boleh terikat ke cabang");
      }
      finalBranchId = null;
    }

    if (user.role === "OWNER" && user.isActive && finalRole !== "OWNER") {
      if ((await countOtherActiveOwners(tx, id)) === 0) {
        throw conflict(
          "Owner aktif terakhir tidak dapat diturunkan role-nya. Harus selalu ada minimal 1 Owner aktif.",
          "LAST_OWNER",
        );
      }
    }

    if (input.email !== undefined && input.email !== user.email) {
      await assertEmailFree(tx, input.email, id);
    }

    return tx.user.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        role: finalRole,
        branchId: finalBranchId,
        ...(passwordHash ? { password: passwordHash } : {}),
      },
      select: userSelect,
    });
  });
}

/** Menonaktifkan user TIDAK memengaruhi cabangnya (bagian 4.2). */
export async function deactivateUser(id: number, actorId: number) {
  return prisma.$transaction(async (tx) => {
    await lockActiveOwners(tx);

    const user = await tx.user.findUnique({ where: { id } });
    if (!user) throw notFound("User tidak ditemukan.");
    if (user.id === actorId) {
      throw conflict("Anda tidak dapat menonaktifkan akun Anda sendiri.", "SELF_DEACTIVATE");
    }
    if (!user.isActive) throw conflict("User sudah nonaktif.", "USER_STATE_UNCHANGED");
    if (user.role === "OWNER" && (await countOtherActiveOwners(tx, id)) === 0) {
      throw conflict("Harus selalu ada minimal 1 Owner aktif.", "LAST_OWNER");
    }

    return tx.user.update({ where: { id }, data: { isActive: false }, select: userSelect });
  });
}

export async function activateUser(id: number) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id }, select: { isActive: true } });
    if (!user) throw notFound("User tidak ditemukan.");
    if (user.isActive) throw conflict("User sudah aktif.", "USER_STATE_UNCHANGED");
    return tx.user.update({ where: { id }, data: { isActive: true }, select: userSelect });
  });
}
