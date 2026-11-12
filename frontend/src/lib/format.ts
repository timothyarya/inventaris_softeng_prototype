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

/** Tanggal hari ini (YYYY-MM-DD) di zona Asia/Jakarta. */
export function todayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Tanggal murni (YYYY-MM-DD, tanpa jam) ditampilkan apa adanya tanpa pergeseran zona waktu. */
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** Tanggal pertama bulan berjalan (YYYY-MM-DD) di zona Asia/Jakarta. */
export function firstOfMonthJakarta(): string {
  return `${todayJakarta().slice(0, 8)}01`;
}
