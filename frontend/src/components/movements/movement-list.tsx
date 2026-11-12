"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/data/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useMe } from "@/hooks/use-auth";
import { useBranches } from "@/hooks/use-branches";
import { useMovements } from "@/hooks/use-movements";
import { useAllProducts } from "@/hooks/use-products";
import { formatBranch, formatDateTime, formatNumber } from "@/lib/format";
import type { Movement, MovementType } from "@/lib/types";

const TYPE_LABEL: Record<MovementType, string> = {
  MASUK: "Stok masuk",
  TRANSFER_OUT: "Transfer keluar",
  TRANSFER_IN: "Transfer masuk",
  OPNAME: "Opname",
};

const TYPE_CLASS: Record<MovementType, string> = {
  MASUK: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  TRANSFER_OUT: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  TRANSFER_IN: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  OPNAME: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

/** Qty bertanda: +5 hijau, −3 merah. */
function signedQty(value: number): string {
  return value > 0 ? `+${formatNumber(value)}` : `−${formatNumber(Math.abs(value))}`;
}

/**
 * Tautan ke dokumen sumber. Stok masuk hanya dapat dibuka Owner/Admin Gudang (halamannya bukan
 * untuk Pegawai Cabang), jadi bagi Pegawai Cabang nomornya tampil sebagai teks.
 */
function docHref(m: Movement, isAdmin: boolean): string | null {
  switch (m.refType) {
    case "STOCK_IN":
      return isAdmin ? `/stok-masuk/${m.refId}` : null;
    case "TRANSFER":
      return `/transfer/${m.refId}`;
    case "OPNAME":
      return `/opname/${m.refId}`;
  }
}

/**
 * Kolom sesuai spec 4.7. Di layar kecil (< md) kolom Cabang, Tipe, Saldo, Dokumen, dan User
 * disembunyikan dan isinya dipindah ke kolom Waktu, Produk, dan Qty agar tidak perlu scroll samping.
 */
function movementColumns(isAdmin: boolean): Column<Movement>[] {
  const desktopOnly = "max-md:hidden";
  const docLink = (m: Movement) => {
    const href = docHref(m, isAdmin);
    return href ? (
      <Link href={href} className="font-mono text-xs font-medium hover:underline">
        {m.refDocNo}
      </Link>
    ) : (
      <span className="font-mono text-xs">{m.refDocNo}</span>
    );
  };
  const columns: Column<Movement>[] = [
    {
      header: "Waktu",
      cell: (m) => (
        <span>
          {formatDateTime(m.createdAt)}
          <span className="text-muted-foreground mt-0.5 block space-y-0.5 text-xs md:hidden">
            {isAdmin && <span className="block">{m.branch.code}</span>}
            <span className="block">{docLink(m)}</span>
            <span className="block">{m.user.name}</span>
          </span>
        </span>
      ),
    },
  ];
  if (isAdmin) {
    columns.push({
      header: "Cabang",
      className: desktopOnly,
      cell: (m) => formatBranch(m.branch),
    });
  }
  columns.push(
    {
      header: "Produk",
      cell: (m) => (
        <span>
          <span className="font-medium">{m.product.name}</span>
          <span className="text-muted-foreground block font-mono text-xs">{m.product.sku}</span>
          <Badge variant="secondary" className={`mt-1 md:hidden ${TYPE_CLASS[m.type]}`}>
            {TYPE_LABEL[m.type]}
          </Badge>
        </span>
      ),
    },
    {
      header: "Tipe",
      className: desktopOnly,
      cell: (m) => (
        <Badge variant="secondary" className={TYPE_CLASS[m.type]}>
          {TYPE_LABEL[m.type]}
        </Badge>
      ),
    },
    {
      header: "Qty",
      className: "text-right",
      cell: (m) => (
        <span>
          <span
            className={
              m.qty > 0
                ? "font-semibold text-emerald-700 dark:text-emerald-400"
                : "text-destructive font-semibold"
            }
          >
            {signedQty(m.qty)} {m.product.unit}
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs md:hidden">
            Saldo {formatNumber(m.balanceAfter)}
          </span>
        </span>
      ),
    },
    {
      header: "Saldo setelah",
      className: `text-right ${desktopOnly}`,
      cell: (m) => `${formatNumber(m.balanceAfter)} ${m.product.unit}`,
    },
    { header: "Dokumen", className: desktopOnly, cell: docLink },
    { header: "User", className: desktopOnly, cell: (m) => m.user.name },
  );
  return columns;
}

const columnsAdmin = movementColumns(true);
const columnsPegawai = movementColumns(false);

/**
 * Halaman /riwayat untuk semua role. Filter cabang hanya untuk Owner/Admin Gudang; Pegawai
 * Cabang selalu melihat cabangnya sendiri (dipaksa backend, bagian 3.3).
 */
export function MovementList() {
  const me = useMe();
  const isAdmin = me.data ? me.data.role !== "PEGAWAI_CABANG" : false;
  const [branchId, setBranchId] = useState("");
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<MovementType | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const branches = useBranches({ page: 1, pageSize: 100 }, { enabled: isAdmin });
  const products = useAllProducts();

  const rangeInvalid = from !== "" && to !== "" && from > to;
  const query = useMovements({
    page,
    pageSize: 20,
    branchId: isAdmin && branchId ? Number(branchId) : undefined,
    productId: productId ? Number(productId) : undefined,
    type: type || undefined,
    from: rangeInvalid ? undefined : from || undefined,
    to: rangeInvalid ? undefined : to || undefined,
  });

  const own = me.data?.branch;
  const filtered = Boolean(branchId || productId || type || from || to);
  const reset = () => {
    setBranchId("");
    setProductId("");
    setType("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Riwayat Stok"
        description={
          isAdmin
            ? "Semua pergerakan stok (buku besar), terbaru dulu. Saldo adalah stok produk di cabang itu setelah pergerakan."
            : own
              ? `Pergerakan stok di ${formatBranch(own)}, terbaru dulu.`
              : "Pergerakan stok cabang Anda, terbaru dulu."
        }
      />

      <div className="flex flex-wrap items-end gap-2">
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
                {b.isActive ? "" : " (nonaktif)"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <NativeSelect
          aria-label="Filter produk"
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setPage(1);
          }}
          className="max-w-full"
        >
          <NativeSelectOption value="">Semua produk</NativeSelectOption>
          {products.data?.map((p) => (
            <NativeSelectOption key={p.id} value={String(p.id)}>
              {p.sku} — {p.name}
              {p.isActive ? "" : " (nonaktif)"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Filter tipe"
          value={type}
          onChange={(e) => {
            setType(e.target.value as MovementType | "");
            setPage(1);
          }}
        >
          <NativeSelectOption value="">Semua tipe</NativeSelectOption>
          {(Object.keys(TYPE_LABEL) as MovementType[]).map((t) => (
            <NativeSelectOption key={t} value={t}>
              {TYPE_LABEL[t]}
            </NativeSelectOption>
          ))}
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
        {filtered && (
          <Button variant="ghost" onClick={reset}>
            Hapus filter
          </Button>
        )}
      </div>
      {rangeInvalid && (
        <p className="text-destructive text-sm">Tanggal mulai tidak boleh setelah tanggal akhir.</p>
      )}

      <DataTable
        columns={isAdmin ? columnsAdmin : columnsPegawai}
        rows={query.data?.data}
        meta={query.data?.meta}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onPageChange={setPage}
        rowKey={(m) => m.id}
        emptyTitle="Belum ada pergerakan stok"
        emptyDescription="Tidak ada pergerakan yang cocok dengan filter ini."
      />
    </div>
  );
}
