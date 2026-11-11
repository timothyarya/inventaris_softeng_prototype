"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/data/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useMe } from "@/hooks/use-auth";
import { useBranches } from "@/hooks/use-branches";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useStocks } from "@/hooks/use-stocks";
import { formatBranch, formatNumber } from "@/lib/format";
import type { StockRow } from "@/lib/types";

export function StockStatusBadge({ row }: { row: StockRow }) {
  if (row.status === "HABIS") {
    return (
      <Badge
        variant="secondary"
        className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
      >
        Habis
      </Badge>
    );
  }
  if (row.status === "MENIPIS") {
    return (
      <Badge
        variant="secondary"
        className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
      >
        Menipis
      </Badge>
    );
  }
  if (!row.product.isActive) {
    return (
      <Badge
        variant="secondary"
        className="bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      >
        Produk nonaktif
      </Badge>
    );
  }
  return <span className="text-muted-foreground">Aman</span>;
}

/** Warna angka stok mengikuti status: habis merah, menipis kuning, aman biasa. */
export function stockQtyClass(status: StockRow["status"]) {
  if (status === "HABIS") return "text-destructive font-semibold";
  if (status === "MENIPIS") return "font-semibold text-yellow-700 dark:text-yellow-400";
  return "font-medium";
}

export const stockColumns: Column<StockRow>[] = [
  { header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.product.sku}</span> },
  { header: "Produk", cell: (r) => <span className="font-medium">{r.product.name}</span> },
  { header: "Kategori", cell: (r) => r.product.category ?? "—" },
  {
    header: "Stok",
    className: "text-right",
    cell: (r) => (
      <span className={stockQtyClass(r.status)}>
        {formatNumber(r.qty)} {r.product.unit}
      </span>
    ),
  },
  { header: "Stok min.", className: "text-right", cell: (r) => formatNumber(r.product.minStock) },
  { header: "Status", cell: (r) => <StockStatusBadge row={r} /> },
];

/**
 * Daftar stok satu cabang. Owner/Admin Cabang memilih cabang (default gudang utama);
 * Pegawai Cabang selalu melihat cabangnya sendiri (backend memaksa, bagian 3.3).
 */
export function StockList({ mode }: { mode: "admin" | "pegawai" }) {
  const me = useMe();
  const branches = useBranches({ page: 1, pageSize: 100 }); // semua cabang (aktif dan nonaktif)
  const [selected, setSelected] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "MENIPIS" | "HABIS">("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const branchList = branches.data?.data ?? [];
  const mainBranch = branchList.find((b) => b.isMain);
  // Admin: pilihan user, atau gudang utama sebelum dipilih. Pegawai Cabang: tidak dikirim.
  const branchId = mode === "admin" ? (selected ? Number(selected) : mainBranch?.id) : undefined;

  const query = useStocks(
    { page, pageSize: 20, branchId, q: q || undefined, status: statusFilter || undefined },
    { enabled: mode === "pegawai" || branchId !== undefined },
  );

  const own = me.data?.branch;
  const title = mode === "admin" ? "Stok Cabang" : "Inventaris";
  const description =
    mode === "admin"
      ? "Stok per produk di setiap cabang. Menipis: jumlahnya di bawah stok minimum. Habis: stok 0."
      : own
        ? `Stok produk di ${formatBranch(own)}.`
        : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description} />

      <div className="flex flex-wrap items-center gap-2">
        {mode === "admin" && (
          <NativeSelect
            value={branchId ? String(branchId) : ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setPage(1);
            }}
            disabled={branches.isPending}
            aria-label="Pilih cabang"
          >
            {branchList.map((b) => (
              <NativeSelectOption key={b.id} value={String(b.id)}>
                {formatBranch(b)}
                {b.isActive ? "" : " (nonaktif)"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <div className="relative w-full max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari SKU atau nama produk…"
            className="pl-8"
            aria-label="Cari produk"
          />
        </div>
        <NativeSelect
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "" | "MENIPIS" | "HABIS");
            setPage(1);
          }}
          aria-label="Filter stok"
        >
          <NativeSelectOption value="">Semua stok</NativeSelectOption>
          <NativeSelectOption value="MENIPIS">Menipis saja</NativeSelectOption>
          <NativeSelectOption value="HABIS">Habis saja</NativeSelectOption>
        </NativeSelect>
      </div>

      <DataTable
        columns={stockColumns}
        rows={query.data?.data}
        meta={query.data?.meta}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onPageChange={setPage}
        rowKey={(r) => `${r.branch.id}-${r.product.id}`}
        emptyTitle={
          statusFilter === "MENIPIS"
            ? "Tidak ada stok menipis"
            : statusFilter === "HABIS"
              ? "Tidak ada stok habis"
              : "Tidak ada produk"
        }
        emptyDescription={
          statusFilter === "MENIPIS"
            ? "Tidak ada produk yang di bawah stok minimum."
            : statusFilter === "HABIS"
              ? "Semua produk masih memiliki stok."
              : "Ubah kata kunci pencarian."
        }
      />
    </div>
  );
}
