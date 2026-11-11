import { Badge } from "@/components/ui/badge";
import type { TransferOrigin, TransferStatus } from "@/lib/types";

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  DIAJUKAN: "Diajukan",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
  DIBATALKAN: "Dibatalkan",
  DIKIRIM: "Dikirim",
  DITERIMA: "Diterima",
};

const STATUS_CLASS: Record<TransferStatus, string> = {
  DIAJUKAN: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  DISETUJUI: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  DITOLAK: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  DIBATALKAN: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  DIKIRIM: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  DITERIMA: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  return (
    <Badge variant="secondary" className={STATUS_CLASS[status]}>
      {TRANSFER_STATUS_LABEL[status]}
    </Badge>
  );
}

export const ORIGIN_LABEL: Record<TransferOrigin, string> = {
  REQUEST: "Request cabang",
  DIRECT: "Pengiriman langsung",
};

/** Kelas untuk tab bergaya garis bawah (dipakai tombol maupun tautan). */
export function tabClass(active: boolean) {
  return [
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
    active
      ? "border-primary text-foreground"
      : "text-muted-foreground hover:text-foreground border-transparent",
  ].join(" ");
}
