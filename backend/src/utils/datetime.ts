const TIME_ZONE = "Asia/Jakarta";

// "en-CA" menghasilkan format YYYY-MM-DD.
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Tanggal (YYYY-MM-DD) pada zona Asia/Jakarta, bukan UTC (bagian 5.6 dan 4.10). */
export function jakartaDate(at: Date = new Date()): string {
  return dateFormatter.format(at);
}

/** YYYY-MM-DD yang valid secara kalender (menolak 2026-02-30). */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Kolom `@db.Date` Prisma menerima Date pada tengah malam UTC dari tanggal tersebut. */
export const dateOnly = (value: string): Date => new Date(`${value}T00:00:00Z`);
