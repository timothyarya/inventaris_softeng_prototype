"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/data/page-header";
import { ActiveBadge } from "@/components/data/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useBranches } from "@/hooks/use-branches";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { formatBranch, formatNumber } from "@/lib/format";
import type { Branch } from "@/lib/types";

type StatusFilter = "all" | "active" | "inactive";

const columns: Column<Branch>[] = [
  {
    header: "Cabang",
    cell: (b) => (
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/cabang/${b.id}`} className="font-medium hover:underline">
          {formatBranch(b)}
        </Link>
        {b.isMain && <Badge variant="outline">Gudang utama</Badge>}
      </div>
    ),
  },
  { header: "Alamat", cell: (b) => b.address ?? "—" },
  { header: "Telepon", cell: (b) => b.phone ?? "—" },
  { header: "Pegawai Cabang", className: "text-right", cell: (b) => formatNumber(b.userCount) },
  { header: "Status", cell: (b) => <ActiveBadge active={b.isActive} /> },
];

export function BranchList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const query = useBranches({
    page,
    pageSize: 20,
    q: q || undefined,
    active: status === "all" ? undefined : status === "active",
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cabang"
        description="Kelola gudang utama dan cabang."
        actions={
          <Button render={<Link href="/cabang/baru" />} nativeButton={false}>
            <Plus />
            Tambah Cabang
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
            placeholder="Cari kode atau nama cabang…"
            className="pl-8"
            aria-label="Cari cabang"
          />
        </div>
        <NativeSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter);
            setPage(1);
          }}
          aria-label="Filter status"
        >
          <NativeSelectOption value="all">Semua status</NativeSelectOption>
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
        rowKey={(b) => b.id}
        emptyTitle="Tidak ada cabang"
        emptyDescription="Ubah kata kunci atau filter pencarian."
      />
    </div>
  );
}
