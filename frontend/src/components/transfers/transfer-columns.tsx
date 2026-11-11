import Link from "next/link";
import type { Column } from "@/components/data/data-table";
import { formatBranch, formatDateTime, formatNumber } from "@/lib/format";
import type { TransferSummary } from "@/lib/types";
import { ORIGIN_LABEL, TransferStatusBadge } from "./transfer-status";

const qty = (value: number | null) => (value === null ? "—" : formatNumber(value));

export function transferColumns({
  showBranch,
}: {
  showBranch: boolean;
}): Column<TransferSummary>[] {
  const columns: Column<TransferSummary>[] = [
    {
      header: "No. Dokumen",
      cell: (t) => (
        <Link href={`/transfer/${t.id}`} className="font-mono text-xs font-medium hover:underline">
          {t.docNo}
        </Link>
      ),
    },
    { header: "Status", cell: (t) => <TransferStatusBadge status={t.status} /> },
    { header: "Jenis", cell: (t) => ORIGIN_LABEL[t.origin] },
  ];
  if (showBranch) columns.push({ header: "Tujuan", cell: (t) => formatBranch(t.toBranch) });
  columns.push(
    { header: "Item", className: "text-right", cell: (t) => formatNumber(t.itemCount) },
    { header: "Diminta", className: "text-right", cell: (t) => qty(t.totalRequested) },
    { header: "Dikirim", className: "text-right", cell: (t) => qty(t.totalSent) },
    { header: "Diterima", className: "text-right", cell: (t) => qty(t.totalReceived) },
    { header: "Tanggal", cell: (t) => formatDateTime(t.requestedAt ?? t.createdAt) },
  );
  return columns;
}
