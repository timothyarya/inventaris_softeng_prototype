import type { Role } from "../../generated/prisma/client";

/**
 * Siapa yang boleh memverifikasi (setujui/tolak) sebuah opname, menurut role PEMBUATNYA
 * (keputusan pemilik proyek, Fase 5):
 *  - dibuat Pegawai Cabang -> Admin Gudang atau Owner
 *  - dibuat Admin Gudang   -> hanya Owner (cabang mana pun, termasuk gudang utama)
 *  - dibuat Owner          -> hanya Owner (Owner boleh memverifikasi opname buatannya sendiri)
 */
export function verifierRolesFor(creatorRole: Role): Role[] {
  return creatorRole === "PEGAWAI_CABANG" ? ["ADMIN_GUDANG", "OWNER"] : ["OWNER"];
}
