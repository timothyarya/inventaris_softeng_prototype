import type { AuthUser } from "../modules/auth/service";
import { forbidden } from "./errors";

/**
 * Scoping cabang (bagian 3.3): untuk Pegawai, branch_id SELALU dari server
 * (req.user.branchId) dan parameter `branchId` dari client diabaikan.
 * Owner/SuperAdmin memakai nilai dari client; null berarti "semua cabang".
 */
export function resolveBranchId(user: AuthUser, requested?: number | null): number | null {
  if (user.role === "PEGAWAI") {
    if (user.branchId === null) throw forbidden("Anda belum ditugaskan ke cabang.");
    return user.branchId;
  }
  return requested ?? null;
}
