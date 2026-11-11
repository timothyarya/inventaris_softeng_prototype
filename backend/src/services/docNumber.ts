import type { Prisma } from "../generated/prisma/client";
import { jakartaDate } from "../utils/datetime";

export type DocPrefix = "SI" | "TR" | "OP";

/**
 * Nomor dokumen `PREFIX-YYYYMMDD-NNNN` (bagian 4.10). Urutan direset per hari per prefix.
 * Satu query atomik di dalam transaksi pemanggil: request bersamaan mengantre pada baris
 * `doc_counters` yang sama sehingga tidak ada nomor ganda. Jika transaksi pemanggil
 * rollback, kenaikan counter ikut dibatalkan (tidak ada lubang nomor).
 * Tanggal memakai zona Asia/Jakarta, bukan UTC.
 */
export async function generateDocNo(
  tx: Prisma.TransactionClient,
  prefix: DocPrefix,
  at: Date = new Date(),
): Promise<string> {
  const day = jakartaDate(at).replaceAll("-", "");
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO doc_counters (prefix, date, last_seq) VALUES (${prefix}, ${day}, 1)
    ON CONFLICT (prefix, date) DO UPDATE SET last_seq = doc_counters.last_seq + 1
    RETURNING last_seq`;
  const seq = rows[0]?.last_seq;
  if (seq === undefined) throw new Error("Gagal membuat nomor dokumen.");
  return `${prefix}-${day}-${String(seq).padStart(4, "0")}`;
}
