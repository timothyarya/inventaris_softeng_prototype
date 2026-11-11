export type Role = "OWNER" | "ADMIN_CABANG" | "PEGAWAI_CABANG";

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
  ADMIN_CABANG: "Admin Cabang",
  PEGAWAI_CABANG: "Pegawai Cabang",
};

export const ME_QUERY_KEY = ["auth", "me"] as const;

/** Pegawai Cabang yang belum/tidak punya cabang hanya boleh melihat /menunggu-penugasan. */
export function isAwaitingAssignment(user: AuthUser): boolean {
  return user.role === "PEGAWAI_CABANG" && user.branchId === null;
}

export function homePathFor(user: AuthUser): string {
  return isAwaitingAssignment(user) ? "/menunggu-penugasan" : "/dashboard";
}
