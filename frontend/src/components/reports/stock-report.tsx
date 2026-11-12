"use client";

import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/data/page-header";
import { differenceClass, formatDifference } from "@/components/opnames/opname-status";
import { StockLevelBadge, stockQtyClass } from "@/components/stocks/stock-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStockReport } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/apiClient";
import { formatBranch, formatDate, formatNumber } from "@/lib/format";
import type { StockReportRow } from "@/lib/types";
import { ReportFilters, useReportFilters } from "./report-filters";

const desktopOnly = "max-md:hidden";

function Movement({ value }: { value: number }) {
  return <span className={differenceClass(value)}>{formatDifference(value)}</span>;
}

function StockRowView({ row }: { row: StockReportRow }) {
  const unit = row.product.unit;
  return (
    <TableRow data-testid="stock-report-row">
      <TableCell className={desktopOnly}>{formatBranch(row.branch)}</TableCell>
      <TableCell className="whitespace-normal">
        <span className="font-medium">{row.product.name}</span>
        <span className="text-muted-foreground block font-mono text-xs">{row.product.sku}</span>
        {/* Layar kecil: cabang, rincian pergerakan, dan status dipindah ke sel Produk. */}
        <span className="text-muted-foreground mt-1 block space-y-0.5 text-xs md:hidden">
          <span className="block">{row.branch.code}</span>
          <span className="block">
            Masuk {formatDifference(row.masuk)} · T. masuk {formatDifference(row.transferIn)}
          </span>
          <span className="block">
            T. keluar {formatDifference(row.transferOut)} · Opname {formatDifference(row.opname)}
          </span>
          {row.status !== "AMAN" && (
            <span className="block">
              <StockLevelBadge status={row.status} />
            </span>
          )}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(row.opening)}</TableCell>
      <TableCell className={`text-right tabular-nums ${desktopOnly}`}>
        <Movement value={row.masuk} />
      </TableCell>
      <TableCell className={`text-right tabular-nums ${desktopOnly}`}>
        <Movement value={row.transferIn} />
      </TableCell>
      <TableCell className={`text-right tabular-nums ${desktopOnly}`}>
        <Movement value={row.transferOut} />
      </TableCell>
      <TableCell className={`text-right tabular-nums ${desktopOnly}`}>
        <Movement value={row.opname} />
      </TableCell>
      <TableCell className={`text-right tabular-nums ${stockQtyClass(row.status)}`}>
        {formatNumber(row.closing)} {unit}
      </TableCell>
      <TableCell className={desktopOnly}>
        <StockLevelBadge status={row.status} />
      </TableCell>
    </TableRow>
  );
}

/**
 * Laporan Stok (bagian 4.8): stok awal, pergerakan per jenis, dan stok akhir per cabang × produk
 * dalam periode. Menipis/Habis dinilai dari stok akhir periode.
 */
export function StockReportView() {
  const filters = useReportFilters();
  const query = useStockReport(filters.params, filters.valid);
  const data = query.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Laporan Stok"
        description="Stok awal, pergerakan, dan stok akhir per cabang dan produk dalam periode. Hanya produk yang punya stok awal atau pergerakan pada periode yang tampil."
      />
      <ReportFilters filters={filters} />

      {query.error && !data && (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-12 text-center">
          <p className="text-sm">{getErrorMessage(query.error)}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      )}

      {data && (
        <p className="text-muted-foreground text-sm" data-testid="stock-report-summary">
          {formatDate(data.from)} – {formatDate(data.to)} ·{" "}
          {data.branch ? formatBranch(data.branch) : "Seluruh cabang"} ·{" "}
          {formatNumber(data.summary.rowCount)} baris · Menipis di akhir periode{" "}
          {formatNumber(data.summary.lowStock)} · Habis di akhir periode{" "}
          {formatNumber(data.summary.outOfStock)}
        </p>
      )}

      {!query.error && (query.isPending ? filters.valid : true) && (
        <div
          className="overflow-x-auto rounded-lg border"
          aria-busy={query.isPending || query.isFetching}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={desktopOnly}>Cabang</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Stok awal</TableHead>
                <TableHead className={`text-right ${desktopOnly}`}>Masuk</TableHead>
                <TableHead className={`text-right ${desktopOnly}`}>Transfer masuk</TableHead>
                <TableHead className={`text-right ${desktopOnly}`}>Transfer keluar</TableHead>
                <TableHead className={`text-right ${desktopOnly}`}>Opname (±)</TableHead>
                <TableHead className="text-right">Stok akhir</TableHead>
                <TableHead className={desktopOnly}>Status akhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isPending &&
                Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {Array.from({ length: 9 }, (_, j) => (
                      <TableCell
                        key={j}
                        className={
                          j === 0 || (j >= 3 && j <= 6) || j === 8 ? desktopOnly : undefined
                        }
                      >
                        <Skeleton className="h-4 w-full max-w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {data?.rows.map((row) => (
                <StockRowView key={`${row.branch.id}-${row.product.id}`} row={row} />
              ))}
            </TableBody>
          </Table>
          {data && data.rows.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center">
              <Inbox className="size-8" />
              <p className="text-foreground text-sm font-medium">Tidak ada data stok</p>
              <p className="text-sm">
                Tidak ada stok awal maupun pergerakan pada periode dan cabang ini.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
