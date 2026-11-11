"use client";

import { Inbox } from "lucide-react";
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
import { getErrorMessage } from "@/lib/apiClient";
import { formatNumber } from "@/lib/format";
import type { PageMeta } from "@/lib/types";

export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

/**
 * Tabel standar (bagian 10): skeleton saat memuat, pesan + tombol coba lagi saat gagal,
 * empty state, dan paginasi.
 */
export function DataTable<T>({
  columns,
  rows,
  meta,
  isLoading,
  isFetching,
  error,
  onRetry,
  onPageChange,
  rowKey,
  emptyTitle,
  emptyDescription,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  meta: PageMeta | undefined;
  isLoading: boolean;
  isFetching?: boolean;
  error: unknown;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  rowKey: (row: T) => string | number;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (error && !rows) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border py-12 text-center">
        <p className="text-sm">{getErrorMessage(error)}</p>
        <Button variant="outline" onClick={onRetry}>
          Coba lagi
        </Button>
      </div>
    );
  }

  const empty = !isLoading && rows && rows.length === 0;

  return (
    <div className="space-y-3">
      <div
        className="overflow-x-auto rounded-lg border"
        aria-busy={isLoading || isFetching}
        data-fetching={isFetching ? "" : undefined}
      >
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.header} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`sk-${i}`}>
                  {columns.map((c) => (
                    <TableCell key={c.header}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading &&
              rows?.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((c) => (
                    <TableCell key={c.header} className={c.className}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {empty && (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center">
            <Inbox className="size-8" />
            <p className="text-foreground text-sm font-medium">{emptyTitle}</p>
            {emptyDescription && <p className="text-sm">{emptyDescription}</p>}
          </div>
        )}
      </div>
      {meta && meta.total > 0 && <Pagination meta={meta} onPageChange={onPageChange} />}
    </div>
  );
}

function Pagination({
  meta,
  onPageChange,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-muted-foreground">
        Menampilkan {formatNumber(from)}–{formatNumber(to)} dari {formatNumber(meta.total)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          Sebelumnya
        </Button>
        <span className="text-muted-foreground">
          Halaman {formatNumber(meta.page)} dari {formatNumber(totalPages)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
