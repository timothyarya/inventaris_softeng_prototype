"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/data/page-header";
import { tabClass } from "@/components/transfers/transfer-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useMe } from "@/hooks/use-auth";
import { useBranches } from "@/hooks/use-branches";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useOpnames } from "@/hooks/use-opnames";
import { formatBranch, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { OpnameStatus, OpnameSummary } from "@/lib/types";
import {
  OPNAME_STATUS_LABEL,
  OpnameStatusBadge,
  differenceClass,
  formatDifference,
} from "./opname-status";

const TABS: { value: OpnameStatus | ""; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "MENUNGGU", label: OPNAME_STATUS_LABEL.MENUNGGU },
  { value: "DISETUJUI", label: OPNAME_STATUS_LABEL.DISETUJUI },
  { value: "DITOLAK", label: OPNAME_STATUS_LABEL.DITOLAK },
];

function opnameColumns(showBranch: boolean): Column<OpnameSummary>[] {
  const columns: Column<OpnameSummary>[] = [
    {
      header: "No. Dokumen",
      cell: (o) => (
        <Link href={`/opname/${o.id}`} className="font-mono text-xs font-medium hover:underline">
          {o.docNo}
        </Link>
      ),
    },
    { header: "Status", cell: (o) => <OpnameStatusBadge status={o.status} /> },
  ];
  if (showBranch) columns.push({ header: "Cabang", cell: (o) => formatBranch(o.branch) });
  columns.push(
    { header: "Tanggal", cell: (o) => formatDate(o.date) },
    { header: "Dibuat oleh", cell: (o) => o.createdBy.name },
    { header: "Item", className: "text-right", cell: (o) => formatNumber(o.itemCount) },
    {
      header: "Item selisih",
      className: "text-right",
      cell: (o) => formatNumber(o.diffItemCount),
    },
    {
      header: "Total selisih",
      className: "text-right",
      cell: (o) => (
        <span className={differenceClass(o.totalDifference)}>
          {formatDifference(o.totalDifference)}
        </span>
      ),
    },
    {
      header: "Diverifikasi",
      cell: (o) =>
        o.verifiedBy && o.verifiedAt ? (
          <span>
            {o.verifiedBy.name}
            <span className="text-muted-foreground block text-xs">
              {formatDateTime(o.verifiedAt)}
            </span>
          </span>
        ) : (
          "—"
        ),
    },
  );
  return columns;
}

/** Halaman /opname untuk semua role. Pegawai Cabang hanya melihat opname cabangnya (dibatasi server). */
export function OpnameList() {
  const me = useMe();
  const isAdmin = me.data ? me.data.role !== "PEGAWAI_CABANG" : false;
  const [status, setStatus] = useState<OpnameStatus | "">("");
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());
  const branches = useBranches({ page: 1, pageSize: 100 }, { enabled: isAdmin });
  const columns = useMemo(() => opnameColumns(isAdmin), [isAdmin]);

  const rangeInvalid = from !== "" && to !== "" && from > to;
  const query = useOpnames({
    page,
    pageSize: 20,
    q: q || undefined,
    status: status || undefined,
    branchId: isAdmin && branchId ? Number(branchId) : undefined,
    from: rangeInvalid ? undefined : from || undefined,
    to: rangeInvalid ? undefined : to || undefined,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stok Opname"
        description={
          isAdmin
            ? "Hitung fisik stok per cabang dan verifikasi selisihnya."
            : "Hitung fisik stok cabang Anda; selisihnya diverifikasi sebelum stok disesuaikan."
        }
        actions={
          <Button render={<Link href="/opname/baru" />} nativeButton={false}>
            <Plus />
            Opname Baru
          </Button>
        }
      />

      <div
        role="tablist"
        aria-label="Status opname"
        className="flex gap-1 overflow-x-auto border-b"
      >
        {TABS.map((tab) => (
          <button
            key={tab.value || "ALL"}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            className={tabClass(status === tab.value)}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={isAdmin ? "Cari no. dokumen atau cabang…" : "Cari no. dokumen…"}
            className="pl-8"
            aria-label="Cari opname"
          />
        </div>
        {isAdmin && (
          <NativeSelect
            aria-label="Filter cabang"
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              setPage(1);
            }}
          >
            <NativeSelectOption value="">Semua cabang</NativeSelectOption>
            {branches.data?.data.map((b) => (
              <NativeSelectOption key={b.id} value={String(b.id)}>
                {formatBranch(b)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
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
        rowKey={(o) => o.id}
        emptyTitle="Belum ada opname"
        emptyDescription="Tidak ada opname yang cocok dengan filter ini."
      />
    </div>
  );
}
