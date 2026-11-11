import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma";
import type { Role } from "../../generated/prisma/enums";
import { unauthorized } from "../../utils/errors";
import { signToken } from "../../utils/jwt";
import type { LoginInput } from "./schema";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  branchId: number | null;
  branch: { id: number; code: string; name: string; isMain: boolean } | null;
};

/** Hash tiruan agar waktu respons login tidak membocorkan apakah email terdaftar. */
const DUMMY_HASH = bcrypt.hashSync("tidak-dipakai", 10);

const userWithBranch = {
  branch: { select: { id: true, code: true, name: true, isMain: true } },
} as const;

export async function findAuthUserById(
  id: number,
): Promise<(AuthUser & { isActive: boolean }) | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      branchId: true,
      isActive: true,
      ...userWithBranch,
    },
  });
  return user;
}

export async function login({ email, password }: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email } });

  const passwordOk = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    throw unauthorized("Email atau password salah.");
  }
  if (!user.isActive) {
    throw unauthorized("Akun Anda dinonaktifkan. Hubungi Owner.");
  }

  const authUser = await findAuthUserById(user.id);
  if (!authUser) throw unauthorized();

  return { token: signToken(user.id), user: toAuthUser(authUser) };
}

export function toAuthUser(user: AuthUser & { isActive?: boolean }): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    branch: user.branch,
  };
}
