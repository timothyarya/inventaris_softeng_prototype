"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useStockIns } from "@/hooks/use-stock-ins";
import { formatDate, formatNumber } from "@/lib/format";
import type { StockInSummary } from "@/lib/types";

const columns: Column<StockInSummary>[] = [
  {
    header: "No. Dokumen",
    cell: (s) => (
      <Link href={`/stok-masuk/${s.id}`} className="font-mono text-xs font-medium hover:underline">
        {s.docNo}
      </Link>
    ),
  },
  { header: "Tanggal", cell: (s) => formatDate(s.date) },
  { header: "Supplier", cell: (s) => s.supplierName },
  { header: "No. Faktur", cell: (s) => s.invoiceNo ?? "—" },
  { header: "Item", className: "text-right", cell: (s) => formatNumber(s.itemCount) },
  { header: "Total Qty", className: "text-right", cell: (s) => formatNumber(s.totalQty) },
  { header: "Dibuat oleh", cell: (s) => s.createdBy.name },
];

export function StockInList() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  // Rentang terbalik ditolak backend; jangan kirim sampai valid.
  const rangeInvalid = from !== "" && to !== "" && from > to;
  const query = useStockIns({
    page,
    pageSize: 20,
    q: q || undefined,
    from: rangeInvalid ? undefined : from || undefined,
    to: rangeInvalid ? undefined : to || undefined,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stok Masuk"
        description="Penerimaan barang dari supplier ke gudang utama. Dokumen bersifat final dan tidak dapat diubah."
        actions={
          <Button render={<Link href="/stok-masuk/baru" />} nativeButton={false}>
            <Plus />
            Tambah Stok Masuk
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari no. dokumen, supplier, faktur…"
            className="pl-8"
            aria-label="Cari stok masuk"
          />
        </div>
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          Dari
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            aria-label="Tanggal mulai"
            className="w-40"
          />
        </label>
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          Sampai
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            aria-label="Tanggal akhir"
            className="w-40"
          />
        </label>
        {(from || to) && (
          <Button
            variant="ghost"
            onClick={() => {
              setFrom("");
              setTo("");
              setPage(1);
            }}
          >
            Hapus filter tanggal
          </Button>
        )}
      </div>
      {rangeInvalid && (
        <p className="text-destructive text-sm">Tanggal mulai tidak boleh setelah tanggal akhir.</p>
      )}

      <DataTable
        columns={columns}
        rows={query.data?.data}
        meta={query.data?.meta}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onPageChange={setPage}
        rowKey={(s) => s.id}
        emptyTitle="Belum ada stok masuk"
        emptyDescription="Catat penerimaan barang pertama lewat tombol Tambah Stok Masuk."
      />
    </div>
  );
}
