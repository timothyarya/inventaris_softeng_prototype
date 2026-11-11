"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { FormField } from "@/components/data/form-field";
import { PageHeader } from "@/components/data/page-header";
import { ActiveBadge } from "@/components/data/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActivateBranch,
  useBranch,
  useDeactivateBranch,
  useUpdateBranch,
} from "@/hooks/use-branches";
import { getErrorMessage } from "@/lib/apiClient";
import { formatBranch, formatNumber } from "@/lib/format";
import type { BranchDetail as BranchDetailData } from "@/lib/types";
import { branchEditSchema, emptyToNull, type BranchEditValues } from "./branch-schema";

export function BranchDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const query = useBranch(valid ? id : 0);

  if (!valid) return <NotFoundState message="Cabang tidak ditemukan." />;

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full max-w-xl" />
      </div>
    );
  }

  // Gagal memuat ulang di latar belakang tidak boleh menggantikan data yang sudah ada.
  if (!query.data) {
    return (
      <NotFoundState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />
    );
  }

  // key memastikan form diisi ulang dengan data terbaru setelah disimpan.
  return <BranchDetailView key={query.data.updatedAt} branch={query.data} />;
}

function NotFoundState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border py-12 text-center">
      <p className="text-sm">{message}</p>
      <div className="flex gap-2">
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Coba lagi
          </Button>
        )}
        <Button variant="outline" render={<Link href="/cabang" />} nativeButton={false}>
          Kembali ke daftar cabang
        </Button>
      </div>
    </div>
  );
}

function BranchDetailView({ branch }: { branch: BranchDetailData }) {
  const update = useUpdateBranch(branch.id);
  const deactivate = useDeactivateBranch(branch.id);
  const activate = useActivateBranch(branch.id);
  const [confirm, setConfirm] = useState<"deactivate" | "activate" | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<BranchEditValues>({
    resolver: zodResolver(branchEditSchema),
    defaultValues: {
      name: branch.name,
      address: branch.address ?? "",
      phone: branch.phone ?? "",
    },
  });

  // mutateAsync (bukan mutate + callback): setelah berhasil, data dimuat ulang dan tampilan ini
  // di-remount lewat `key`, sehingga callback milik mutate() tidak akan dipanggil lagi.
  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        name: values.name,
        address: emptyToNull(values.address),
        phone: emptyToNull(values.phone),
      });
      toast.success("Data cabang disimpan.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  const onDeactivate = async () => {
    try {
      const { effects } = await deactivate.mutateAsync();
      toast.success(
        `Cabang dinonaktifkan. ${formatNumber(effects.usersReleased)} pegawai cabang dilepas, ` +
          `${formatNumber(effects.transfersCancelled)} transfer dibatalkan, ` +
          `${formatNumber(effects.opnamesRejected)} opname ditolak.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setConfirm(null);
    }
  };

  const onActivate = async () => {
    try {
      await activate.mutateAsync();
      toast.success("Cabang diaktifkan kembali. Pegawai Cabang perlu ditugaskan ulang.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setConfirm(null);
    }
  };

  const activeStaff = branch.users.filter((u) => u.isActive).length;
  const summary = branch.stockSummary;

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/cabang" />}
        nativeButton={false}
        className="-ml-2"
      >
        <ArrowLeft />
        Daftar cabang
      </Button>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {formatBranch(branch)}
            {branch.isMain && <Badge variant="outline">Gudang utama</Badge>}
            <ActiveBadge active={branch.isActive} />
          </span>
        }
        actions={
          branch.isMain ? null : branch.isActive ? (
            <Button variant="destructive" onClick={() => setConfirm("deactivate")}>
              Nonaktifkan
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setConfirm("activate")}>
              Aktifkan
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data cabang</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <FormField
                label="Kode cabang"
                htmlFor="code"
                hint="Kode tidak dapat diubah setelah cabang dibuat."
              >
                <Input id="code" value={branch.code} readOnly disabled />
              </FormField>
              <FormField label="Nama cabang" htmlFor="name" error={errors.name?.message}>
                <Input
                  id="name"
                  autoComplete="off"
                  aria-invalid={errors.name ? true : undefined}
                  {...register("name")}
                />
              </FormField>
              <FormField
                label="Alamat (opsional)"
                htmlFor="address"
                error={errors.address?.message}
              >
                <Input id="address" autoComplete="off" {...register("address")} />
              </FormField>
              <FormField label="Telepon (opsional)" htmlFor="phone" error={errors.phone?.message}>
                <Input id="phone" autoComplete="off" {...register("phone")} />
              </FormField>
              <Button type="submit" disabled={update.isPending || !isDirty}>
                {update.isPending && <Loader2 className="animate-spin" />}
                Simpan perubahan
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan stok</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <Stat label="Produk aktif" value={summary.activeProducts} />
                <Stat label="Produk ada stok" value={summary.productsInStock} />
                <Stat label="Total qty" value={summary.totalQty} />
                <Stat label="Stok menipis" value={summary.lowStock} warn={summary.lowStock > 0} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Pegawai Cabang ({formatNumber(branch.users.length)}
                {branch.users.length > 0 && `, ${formatNumber(activeStaff)} aktif`})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {branch.users.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {branch.isMain
                    ? "Gudang utama tidak memiliki pegawai cabang."
                    : "Belum ada pegawai cabang yang ditugaskan ke cabang ini."}
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {branch.users.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <Link href={`/users/${u.id}`} className="font-medium hover:underline">
                          {u.name}
                        </Link>
                        <p className="text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <ActiveBadge active={u.isActive} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "deactivate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Nonaktifkan ${formatBranch(branch)}?`}
        description={
          <div className="space-y-2">
            <p>Dampak penonaktifan cabang ini:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                {formatNumber(branch.users.length)} pegawai cabang dilepas dari cabang dan menunggu
                penugasan ulang.
              </li>
              <li>Transfer berstatus DIAJUKAN yang melibatkan cabang ini dibatalkan.</li>
              <li>Opname berstatus MENUNGGU di cabang ini ditolak otomatis.</li>
              <li>
                Ditolak bila masih ada transfer menuju cabang ini yang sudah DISETUJUI atau DIKIRIM.
              </li>
            </ul>
          </div>
        }
        confirmLabel="Nonaktifkan"
        destructive
        pending={deactivate.isPending}
        onConfirm={onDeactivate}
      />

      <ConfirmDialog
        open={confirm === "activate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Aktifkan ${formatBranch(branch)}?`}
        description="Pegawai Cabang yang sebelumnya dilepas tidak dikembalikan otomatis; tugaskan ulang dari menu User."
        confirmLabel="Aktifkan"
        pending={activate.isPending}
        onConfirm={onActivate}
      />
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-xl font-semibold ${warn ? "text-destructive" : ""}`}>
        {formatNumber(value)}
      </dd>
    </div>
  );
}
