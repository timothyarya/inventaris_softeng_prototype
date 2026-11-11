"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { DataTable } from "@/components/data/data-table";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useTransfers } from "@/hooks/use-transfers";
import { transferColumns } from "./transfer-columns";
import { tabClass } from "./transfer-status";

const columns = transferColumns({ showBranch: false });

/**
 * Halaman /request-stok (Pegawai Cabang). Tab "Request Saya" = request milik cabangnya;
 * tab "Kiriman Masuk" = kiriman berstatus DIKIRIM yang perlu dikonfirmasi (bagian 8).
 */
export function RequestStokList() {
  const incoming = useSearchParams().get("tab") === "masuk";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const query = useTransfers({
    page,
    pageSize: 20,
    q: q || undefined,
    ...(incoming ? { status: "DIKIRIM" } : { origin: "request" as const }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={incoming ? "Kiriman Masuk" : "Request Saya"}
        description={
          incoming
            ? "Kiriman dari gudang utama yang perlu Anda konfirmasi setelah barang tiba."
            : "Request stok ke gudang utama yang diajukan oleh cabang Anda."
        }
        actions={
          <Button render={<Link href="/request-stok/baru" />} nativeButton={false}>
            <Plus />
            Buat Request
          </Button>
        }
      />

      <div role="tablist" aria-label="Jenis daftar" className="flex gap-1 border-b">
        <Link
          href="/request-stok"
          role="tab"
          aria-selected={!incoming}
          className={tabClass(!incoming)}
          onClick={() => setPage(1)}
        >
          Request Saya
        </Link>
        <Link
          href="/request-stok?tab=masuk"
          role="tab"
          aria-selected={incoming}
          className={tabClass(incoming)}
          onClick={() => setPage(1)}
        >
          Kiriman Masuk
        </Link>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Cari no. dokumen…"
          className="pl-8"
          aria-label="Cari transfer"
        />
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
        rowKey={(t) => t.id}
        emptyTitle={incoming ? "Tidak ada kiriman masuk" : "Belum ada request"}
        emptyDescription={
          incoming
            ? "Kiriman yang sedang dalam perjalanan ke cabang Anda akan muncul di sini."
            : "Ajukan request stok pertama lewat tombol Buat Request."
        }
      />
    </div>
  );
}
