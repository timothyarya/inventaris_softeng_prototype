"use client";

import { AlertTriangle, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { FormField } from "@/components/data/form-field";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMe } from "@/hooks/use-auth";
import { useActiveBranches } from "@/hooks/use-branches";
import { useCreateOpname, useOpnamePrefill } from "@/hooks/use-opnames";
import { getErrorMessage } from "@/lib/apiClient";
import { formatBranch, formatNumber, todayJakarta } from "@/lib/format";
import type { OpnamePrefill } from "@/lib/types";
import { differenceClass, formatDifference } from "./opname-status";

/** Batas yang sama dengan backend (keputusan Fase 5). */
const MAX_QTY = 1_000_000;
const MAX_ITEMS = 1000;
const MAX_REMARK = 255;

/** Halaman /opname/baru. Pegawai Cabang: cabangnya sendiri. Owner/Admin Gudang: pilih cabang dulu. */
export function OpnameCreate() {
  const me = useMe();
  const role = me.data?.role;
  const isAdmin = role === "OWNER" || role === "ADMIN_GUDANG";
  const [branchId, setBranchId] = useState("");
  const branches = useActiveBranches({ enabled: isAdmin });

  const branchNumber = Number(branchId);
  const prefillEnabled = role !== undefined && (isAdmin ? branchNumber > 0 : true);
  const prefill = useOpnamePrefill(isAdmin ? branchNumber : undefined, prefillEnabled);

  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader
        title="Opname Baru"
        description="Hitung stok fisik lalu isi jumlahnya. Hanya produk yang diisi yang dicatat; stok baru berubah setelah opname disetujui."
      />

      {isAdmin && (
        <Card>
          <CardContent>
            <FormField label="Cabang yang dihitung" htmlFor="branch">
              <NativeSelect
                id="branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full max-w-md"
              >
                <NativeSelectOption value="">Pilih cabang…</NativeSelectOption>
                {branches.data?.data.map((b) => (
                  <NativeSelectOption key={b.id} value={String(b.id)}>
                    {formatBranch(b)}
                    {b.isMain ? " (gudang utama)" : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            {branches.error && (
              <p className="text-destructive mt-2 text-sm">{getErrorMessage(branches.error)}</p>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && !branchId && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Pilih cabang terlebih dahulu untuk menampilkan daftar produk dan stok sistemnya.
        </p>
      )}

      {prefillEnabled && prefill.isPending && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {prefillEnabled && !prefill.data && prefill.error && (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-10 text-center">
          <p className="text-sm">{getErrorMessage(prefill.error)}</p>
          <Button variant="outline" onClick={() => void prefill.refetch()}>
            Coba lagi
          </Button>
        </div>
      )}

      {prefillEnabled && prefill.data && (
        <FillForm
          key={prefill.data.branch.id}
          prefill={prefill.data}
          branchId={isAdmin ? branchNumber : undefined}
        />
      )}
    </div>
  );
}

type CountRow = { productId: number; qty: number; remark: string | null };

function FillForm({ prefill, branchId }: { prefill: OpnamePrefill; branchId?: number }) {
  const router = useRouter();
  const create = useCreateOpname();
  const [date, setDate] = useState(todayJakarta());
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [physical, setPhysical] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const today = todayJakarta();
  const dateError =
    date === "" ? "Tanggal wajib diisi" : date > today ? "Tanggal tidak boleh di masa depan" : null;

  // Galat per produk. Qty kosong = tidak dihitung (tidak ikut dicatat).
  const rowErrors = (productId: number) => {
    const raw = (physical[productId] ?? "").trim();
    const remark = remarks[productId] ?? "";
    const errors: { qty?: string; remark?: string } = {};
    if (raw === "") {
      if (remark.trim() !== "" && submitted) errors.qty = "Isi qty fisik atau hapus keterangan";
    } else if (!/^\d+$/.test(raw)) {
      errors.qty = "Bilangan bulat ≥ 0";
    } else if (Number(raw) > MAX_QTY) {
      errors.qty = `Maks. ${formatNumber(MAX_QTY)}`;
    }
    if (remark.trim().length > MAX_REMARK) errors.remark = `Maks. ${MAX_REMARK} karakter`;
    return errors;
  };

  const counted: CountRow[] = [];
  let invalidRows = 0;
  let totalDifference = 0;
  let diffItems = 0;
  for (const row of prefill.items) {
    const id = row.product.id;
    const raw = (physical[id] ?? "").trim();
    const errors = rowErrors(id);
    if (errors.qty || errors.remark) {
      invalidRows++;
      continue;
    }
    if (raw === "") continue;
    const qty = Number(raw);
    counted.push({ productId: id, qty, remark: (remarks[id] ?? "").trim() || null });
    if (qty !== row.qtySystem) {
      diffItems++;
      totalDifference += qty - row.qtySystem;
    }
  }

  const keyword = search.trim().toLowerCase();
  const visible = keyword
    ? prefill.items.filter(
        (r) =>
          r.product.sku.toLowerCase().includes(keyword) ||
          r.product.name.toLowerCase().includes(keyword),
      )
    : prefill.items;

  const blocked = prefill.pendingOpname !== null;
  const tooMany = counted.length > MAX_ITEMS;

  const trySubmit = () => {
    setSubmitted(true);
    if (blocked || dateError) return;
    // `submitted` baru berlaku pada render berikutnya; hitung ulang galat "keterangan tanpa qty".
    const orphanRemark = prefill.items.some(
      (r) =>
        (physical[r.product.id] ?? "").trim() === "" && (remarks[r.product.id] ?? "").trim() !== "",
    );
    if (invalidRows > 0 || orphanRemark) {
      toast.error("Ada isian yang belum valid. Periksa baris yang bertanda merah.");
      return;
    }
    if (counted.length === 0) {
      toast.error("Isi qty fisik minimal satu produk.");
      return;
    }
    if (tooMany) return;
    setConfirmOpen(true);
  };

  const save = async () => {
    try {
      const doc = await create.mutateAsync({
        branchId,
        date,
        note: note.trim() || null,
        items: counted.map((c) => ({
          productId: c.productId,
          qtyPhysical: c.qty,
          remark: c.remark,
        })),
      });
      toast.success(`Opname ${doc.docNo} disimpan dan menunggu verifikasi.`);
      router.push(`/opname/${doc.id}`);
    } catch (error) {
      setConfirmOpen(false);
      toast.error(getErrorMessage(error), { duration: 10_000 });
    }
  };

  return (
    <div className="space-y-4">
      {blocked && prefill.pendingOpname && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Cabang ini masih memiliki opname yang menunggu verifikasi (
            <Link
              href={`/opname/${prefill.pendingOpname.id}`}
              className="font-mono font-medium underline"
            >
              {prefill.pendingOpname.docNo}
            </Link>
            ). Opname baru dapat dibuat setelah opname tersebut disetujui atau ditolak.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Data opname</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Cabang</p>
            <p className="text-sm" data-testid="opname-branch">
              {formatBranch(prefill.branch)}
              {prefill.branch.isMain ? " (gudang utama)" : ""}
            </p>
          </div>
          <FormField label="Tanggal penghitungan" htmlFor="date" error={dateError ?? undefined}>
            <Input
              id="date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={dateError ? true : undefined}
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Catatan (opsional)" htmlFor="note">
              <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hitung fisik ({formatNumber(prefill.items.length)} produk aktif)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Isi <strong>Fisik</strong> hanya untuk produk yang dihitung; baris yang dikosongkan
            tidak dicatat dan stoknya tidak berubah. Gunakan keterangan untuk retur, rusak, atau
            hilang.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari SKU atau nama produk…"
                className="pl-8"
                aria-label="Cari produk"
              />
            </div>
            <p className="text-sm" aria-live="polite" data-testid="opname-summary">
              <strong>{formatNumber(counted.length)}</strong> produk dihitung ·{" "}
              <strong>{formatNumber(diffItems)}</strong> berselisih · total selisih{" "}
              <span className={differenceClass(totalDifference)}>
                {formatDifference(totalDifference)}
              </span>
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk dan keterangan</TableHead>
                  <TableHead className="text-right">Sistem</TableHead>
                  <TableHead className="w-24 min-w-24 sm:w-32">Fisik</TableHead>
                  <TableHead className="text-right max-sm:hidden">Selisih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                      {prefill.items.length === 0
                        ? "Belum ada produk aktif."
                        : "Tidak ada produk yang cocok dengan pencarian."}
                    </TableCell>
                  </TableRow>
                )}
                {visible.map((row) => {
                  const id = row.product.id;
                  const raw = (physical[id] ?? "").trim();
                  const errors = rowErrors(id);
                  const valid = raw !== "" && !errors.qty;
                  const diff = valid ? Number(raw) - row.qtySystem : null;
                  return (
                    <TableRow key={id} data-testid="opname-row">
                      <TableCell className="min-w-32 align-top whitespace-normal sm:min-w-40">
                        <p className="font-medium">{row.product.name}</p>
                        <p className="text-muted-foreground mb-1.5 font-mono text-xs">
                          {row.product.sku}
                        </p>
                        <Input
                          value={remarks[id] ?? ""}
                          onChange={(e) =>
                            setRemarks((prev) => ({ ...prev, [id]: e.target.value }))
                          }
                          placeholder="Keterangan: rusak, retur, hilang"
                          aria-label={`Keterangan ${row.product.sku}`}
                          aria-invalid={errors.remark ? true : undefined}
                          disabled={blocked}
                          autoComplete="off"
                          className="max-w-sm"
                        />
                        {errors.remark && (
                          <p className="text-destructive mt-1 text-xs">{errors.remark}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {formatNumber(row.qtySystem)} {row.product.unit}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={MAX_QTY}
                          step={1}
                          value={physical[id] ?? ""}
                          onChange={(e) =>
                            setPhysical((prev) => ({ ...prev, [id]: e.target.value }))
                          }
                          aria-label={`Qty fisik ${row.product.sku}`}
                          aria-invalid={errors.qty ? true : undefined}
                          disabled={blocked}
                        />
                        {errors.qty && (
                          <p className="text-destructive mt-1 text-xs">{errors.qty}</p>
                        )}
                        {diff !== null && (
                          <p className={`mt-1 text-xs sm:hidden ${differenceClass(diff)}`}>
                            Selisih {formatDifference(diff)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right align-top max-sm:hidden ${diff === null ? "text-muted-foreground" : differenceClass(diff)}`}
                      >
                        {diff === null ? "—" : formatDifference(diff)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {tooMany && (
            <p className="text-destructive text-sm">
              Maksimal {formatNumber(MAX_ITEMS)} produk per opname. Kurangi jumlah baris yang diisi.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={trySubmit} disabled={blocked || create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" />}
          Simpan Opname
        </Button>
        <Button variant="outline" render={<Link href="/opname" />} nativeButton={false}>
          Batal
        </Button>
        {submitted && invalidRows > 0 && (
          <p className="text-destructive text-sm">{formatNumber(invalidRows)} baris belum valid.</p>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Simpan opname?"
        description={
          <div className="space-y-2">
            <p>
              <strong>{formatNumber(counted.length)}</strong> produk dihitung di{" "}
              <strong>{formatBranch(prefill.branch)}</strong>, dengan{" "}
              <strong>{formatNumber(diffItems)}</strong> produk berselisih (total{" "}
              {formatDifference(totalDifference)}).
            </p>
            <p>
              Opname akan menunggu verifikasi. Stok baru berubah setelah opname disetujui, dan
              cabang tidak dapat membuat opname lain selama masih menunggu.
            </p>
          </div>
        }
        confirmLabel="Simpan Opname"
        pending={create.isPending}
        onConfirm={() => void save()}
      />
    </div>
  );
}
