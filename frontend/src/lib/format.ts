import type { BranchRef } from "./types";

/** Kode cabang selalu ditampilkan bersama namanya, mis. "CB01 — Cabang Jalan Kenangan". */
export function formatBranch(branch: Pick<BranchRef, "code" | "name">): string {
  return `${branch.code} — ${branch.name}`;
}

/** Angka berformat locale id-ID (bagian 10). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

/** Tanggal dan jam di zona Asia/Jakarta (bagian 5.6 dan 10). */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}
