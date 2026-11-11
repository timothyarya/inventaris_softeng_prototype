"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/data/data-table";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useBranches } from "@/hooks/use-branches";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useTransfers } from "@/hooks/use-transfers";
import { formatBranch } from "@/lib/format";
import type { TransferStatus } from "@/lib/types";
import { transferColumns } from "./transfer-columns";
import { TRANSFER_STATUS_LABEL, tabClass } from "./transfer-status";

const columns = transferColumns({ showBranch: true });

const STATUS_ORDER: TransferStatus[] = [
  "DIAJUKAN",
  "DISETUJUI",
  "DIKIRIM",
  "DITERIMA",
  "DITOLAK",
  "DIBATALKAN",
];

const TABS: { value: TransferStatus | ""; label: string }[] = [
  { value: "", label: "Semua" },
  ...STATUS_ORDER.map((s) => ({ value: s, label: TRANSFER_STATUS_LABEL[s] })),
];

/** Halaman /transfer (Owner, SuperAdmin): semua pengajuan, dengan tab per status. */
export function TransferList() {
  const [status, setStatus] = useState<TransferStatus | "">("");
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [origin, setOrigin] = useState<"" | "request" | "direct">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());
  const branches = useBranches({ page: 1, pageSize: 100 });

  const rangeInvalid = from !== "" && to !== "" && from > to;
  const query = useTransfers({
    page,
    pageSize: 20,
    q: q || undefined,
    status: status || undefined,
    branchId: branchId ? Number(branchId) : undefined,
    origin: origin || undefined,
    from: rangeInvalid ? undefined : from || undefined,
    to: rangeInvalid ? undefined : to || undefined,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Semua Pengajuan"
        description="Request dari cabang dan pengiriman langsung dari gudang utama."
        actions={
          <Button render={<Link href="/transfer/kirim" />} nativeButton={false}>
            <Plus />
            Form Pengiriman
          </Button>
        }
      />

      <div
        role="tablist"
        aria-label="Status transfer"
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
            placeholder="Cari no. dokumen atau cabang…"
            className="pl-8"
            aria-label="Cari transfer"
          />
        </div>
        <NativeSelect
          aria-label="Filter cabang tujuan"
          value={branchId}
          onChange={(e) => {
            setBranchId(e.target.value);
            setPage(1);
          }}
        >
          <NativeSelectOption value="">Semua cabang</NativeSelectOption>
          {branches.data?.data
            .filter((b) => !b.isMain)
            .map((b) => (
              <NativeSelectOption key={b.id} value={String(b.id)}>
                {formatBranch(b)}
              </NativeSelectOption>
            ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Filter jenis"
          value={origin}
          onChange={(e) => {
            setOrigin(e.target.value as "" | "request" | "direct");
            setPage(1);
          }}
        >
          <NativeSelectOption value="">Semua jenis</NativeSelectOption>
          <NativeSelectOption value="request">Request cabang</NativeSelectOption>
          <NativeSelectOption value="direct">Pengiriman langsung</NativeSelectOption>
        </NativeSelect>
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
        rowKey={(t) => t.id}
        emptyTitle="Belum ada transfer"
        emptyDescription="Tidak ada transfer yang cocok dengan filter ini."
      />
    </div>
  );
}
