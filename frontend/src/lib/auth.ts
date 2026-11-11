export type Role = "OWNER" | "SUPERADMIN" | "PEGAWAI";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  branchId: number | null;
  branch: { id: number; code: string; name: string; isMain: boolean } | null;
};

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  SUPERADMIN: "SuperAdmin",
  PEGAWAI: "Pegawai",
};

export const ME_QUERY_KEY = ["auth", "me"] as const;

/** Pegawai yang belum/tidak punya cabang hanya boleh melihat /menunggu-penugasan. */
export function isAwaitingAssignment(user: AuthUser): boolean {
  return user.role === "PEGAWAI" && user.branchId === null;
}

export function homePathFor(user: AuthUser): string {
  return isAwaitingAssignment(user) ? "/menunggu-penugasan" : "/dashboard";
}
