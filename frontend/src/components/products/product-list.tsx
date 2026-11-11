"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/data/page-header";
import { ActiveBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useAllCategories } from "@/hooks/use-categories";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useProducts } from "@/hooks/use-products";
import { formatNumber } from "@/lib/format";
import type { Product } from "@/lib/types";

const columns: Column<Product>[] = [
  { header: "SKU", cell: (p) => <span className="font-mono text-xs">{p.sku}</span> },
  {
    header: "Nama",
    cell: (p) => (
      <Link href={`/produk/${p.id}`} className="font-medium hover:underline">
        {p.name}
      </Link>
    ),
  },
  { header: "Kategori", cell: (p) => p.category?.name ?? "—" },
  { header: "Satuan", cell: (p) => p.unit },
  { header: "Stok min.", className: "text-right", cell: (p) => formatNumber(p.minStock) },
  { header: "Status", cell: (p) => <ActiveBadge active={p.isActive} /> },
];

export function ProductList() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());
  const categories = useAllCategories();

  const query = useProducts({
    page,
    pageSize: 20,
    q: q || undefined,
    categoryId: category ? Number(category) : undefined,
    status: status || undefined,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Produk"
        description="Master data produk untuk seluruh cabang."
        actions={
          <Button render={<Link href="/produk/baru" />} nativeButton={false}>
            <Plus />
            Tambah Produk
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
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
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          aria-label="Filter kategori"
        >
          <NativeSelectOption value="">Semua kategori</NativeSelectOption>
          {categories.data?.data.map((c) => (
            <NativeSelectOption key={c.id} value={String(c.id)}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | "active" | "inactive");
            setPage(1);
          }}
          aria-label="Filter status"
        >
          <NativeSelectOption value="">Semua status</NativeSelectOption>
          <NativeSelectOption value="active">Aktif</NativeSelectOption>
          <NativeSelectOption value="inactive">Nonaktif</NativeSelectOption>
        </NativeSelect>
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.data}
        meta={query.data?.meta}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onPageChange={setPage}
        rowKey={(p) => p.id}
        emptyTitle="Tidak ada produk"
        emptyDescription="Ubah kata kunci atau filter pencarian."
      />
    </div>
  );
}
