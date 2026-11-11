import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import type { OpnameStatus } from "@/lib/types";

export const OPNAME_STATUS_LABEL: Record<OpnameStatus, string> = {
  MENUNGGU: "Menunggu",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
};

const STATUS_CLASS: Record<OpnameStatus, string> = {
  MENUNGGU: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  DISETUJUI: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  DITOLAK: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function OpnameStatusBadge({ status }: { status: OpnameStatus }) {
  return (
    <Badge variant="secondary" className={STATUS_CLASS[status]}>
      {OPNAME_STATUS_LABEL[status]}
    </Badge>
  );
}

/** Selisih bertanda: +5 (lebih), −3 (kurang), 0 (cocok). */
export function formatDifference(value: number): string {
  if (value > 0) return `+${formatNumber(value)}`;
  if (value < 0) return `−${formatNumber(Math.abs(value))}`;
  return "0";
}

export function differenceClass(value: number): string {
  if (value > 0) return "font-medium text-emerald-700 dark:text-emerald-400";
  if (value < 0) return "font-medium text-red-700 dark:text-red-400";
  return "text-muted-foreground";
}
