"use client";

import { ChevronDown, ChevronRight, Inbox } from "lucide-react";
import { Fragment, useState } from "react";
import { PageHeader } from "@/components/data/page-header";
import { ORIGIN_LABEL, TransferStatusBadge } from "@/components/transfers/transfer-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDistributionReport } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/apiClient";
import { formatBranch, formatDate, formatNumber } from "@/lib/format";
import type { DistributionRow } from "@/lib/types";
import { ReportFilters, useReportFilters } from "./report-filters";

const desktopOnly = "max-md:hidden";
const rowKey = (r: DistributionRow) => `${r.branch.id}-${r.origin}`;

function shortfallClass(value: number) {
  return value > 0 ? "font-medium text-red-700 dark:text-red-400" : "text-muted-foreground";
}

function DetailTable({ row }: { row: DistributionRow }) {
  if (row.items.length === 0) {
    return <p className="text-muted-foreground text-sm">Tidak ada rincian produk.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produk</TableHead>
          <TableHead className="text-right">Dikirim</TableHead>
          <TableHead className="text-right">Diterima</TableHead>
          <TableHead className="text-right">
            <span className="md:hidden">Selisih</span>
            <span className="max-md:hidden">Selisih kirim</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {row.items.map((i) => (
          <TableRow key={i.product.id} data-testid="distribution-detail-row">
            <TableCell className="whitespace-normal">
              <span className="font-medium">{i.product.name}</span>
              <span className="text-muted-foreground block font-mono text-xs">{i.product.sku}</span>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(i.qtySent)} {i.product.unit}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(i.qtyReceived)} {i.product.unit}
            </TableCell>
            <TableCell className={`text-right tabular-nums ${shortfallClass(i.shortfall)}`}>
              {formatNumber(i.shortfall)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Laporan Distribusi (bagian 4.8): rekap per cabang tujuan (request dan pengiriman langsung
 * sebagai baris terpisah) dengan rincian per produk yang dapat dibuka, plus rekap status pengajuan.
 */
export function DistributionReportView() {
  const filters = useReportFilters();
  const query = useDistributionReport(filters.params, filters.valid);
  const data = query.data;
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const showTable = !query.error && (query.isPending ? filters.valid : true);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Laporan Distribusi"
        description="Transfer yang dikirim dalam periode (menurut waktu kirim), direkap per cabang tujuan. Selisih kirim dihitung dari transfer yang sudah diterima."
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
        <p className="text-muted-foreground text-sm" data-testid="distribution-summary">
          {formatDate(data.from)} – {formatDate(data.to)} ·{" "}
          {data.branch ? formatBranch(data.branch) : "Seluruh cabang"} ·{" "}
          {formatNumber(data.totals.transferCount)} transfer · dikirim{" "}
          {formatNumber(data.totals.qtySent)} · diterima {formatNumber(data.totals.qtyReceived)} ·
          selisih kirim {formatNumber(data.totals.shortfall)}
        </p>
      )}

      {showTable && (
        <div
          className="overflow-x-auto rounded-lg border"
          aria-busy={query.isPending || query.isFetching}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cabang tujuan</TableHead>
                <TableHead className={desktopOnly}>Sumber</TableHead>
                <TableHead className={`text-right ${desktopOnly}`}>Transfer</TableHead>
                <TableHead className="text-right">Dikirim</TableHead>
                <TableHead className="text-right">Diterima</TableHead>
                <TableHead className="text-right">
                  <span className="md:hidden">Selisih</span>
                  <span className="max-md:hidden">Selisih kirim</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isPending &&
                Array.from({ length: 4 }, (_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {Array.from({ length: 6 }, (_, j) => (
                      <TableCell key={j} className={j === 1 || j === 2 ? desktopOnly : undefined}>
                        <Skeleton className="h-4 w-full max-w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {data?.rows.map((row) => {
                const key = rowKey(row);
                const isOpen = open.has(key);
                return (
                  <Fragment key={key}>
                    <TableRow data-testid="distribution-row">
                      <TableCell className="whitespace-normal">
                        <button
                          type="button"
                          className="flex items-start gap-1.5 text-left font-medium hover:underline"
                          aria-expanded={isOpen}
                          aria-label={`Rincian produk ${formatBranch(row.branch)}, ${ORIGIN_LABEL[row.origin]}`}
                          onClick={() => toggle(key)}
                        >
                          {isOpen ? (
                            <ChevronDown className="mt-0.5 size-4 shrink-0" />
                          ) : (
                            <ChevronRight className="mt-0.5 size-4 shrink-0" />
                          )}
                          <span>
                            {formatBranch(row.branch)}
                            <span className="text-muted-foreground block text-xs font-normal md:hidden">
                              {ORIGIN_LABEL[row.origin]} · {formatNumber(row.transferCount)}{" "}
                              transfer
                            </span>
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className={desktopOnly}>{ORIGIN_LABEL[row.origin]}</TableCell>
                      <TableCell className={`text-right tabular-nums ${desktopOnly}`}>
                        {formatNumber(row.transferCount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(row.qtySent)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(row.qtyReceived)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${shortfallClass(row.shortfall)}`}
                      >
                        {formatNumber(row.shortfall)}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow data-testid="distribution-detail">
                        <TableCell colSpan={6} className="bg-muted/30">
                          <DetailTable row={row} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
          {data && data.rows.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center">
              <Inbox className="size-8" />
              <p className="text-foreground text-sm font-medium">Tidak ada pengiriman</p>
              <p className="text-sm">
                Tidak ada transfer yang dikirim pada periode dan cabang ini.
              </p>
            </div>
          )}
        </div>
      )}

      {data && (
        <Card data-testid="distribution-status">
          <CardHeader>
            <CardTitle>Status pengajuan</CardTitle>
            <CardDescription>
              Request cabang yang diajukan dalam periode (menurut waktu pengajuan), dikelompokkan
              menurut status saat ini. Pengiriman langsung tidak termasuk.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {data.requestStatus.map((s) => (
                <li
                  key={s.status}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  data-testid={`request-status-${s.status}`}
                >
                  <TransferStatusBadge status={s.status} />
                  <span className="font-semibold tabular-nums">{formatNumber(s.count)}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-sm">
              Total request: {formatNumber(data.requestTotal)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
