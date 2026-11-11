"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { PageHeader } from "@/components/data/page-header";
import { ActiveBadge } from "@/components/data/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-auth";
import { useSetUserActive, useUpdateUser, useUser } from "@/hooks/use-users";
import { getErrorMessage } from "@/lib/apiClient";
import { ROLE_LABEL } from "@/lib/auth";
import type { ManagedUser } from "@/lib/types";
import { UserForm } from "./user-form";
import type { UserFormValues } from "./user-schema";

export function UserDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const query = useUser(valid ? id : 0);

  if (!valid) return <ErrorState message="User tidak ditemukan." />;

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full max-w-xl" />
      </div>
    );
  }

  // Gagal memuat ulang di latar belakang tidak boleh menggantikan data yang sudah ada.
  if (!query.data) {
    return (
      <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />
    );
  }

  // key memastikan form diisi ulang dengan data terbaru setelah disimpan.
  return <UserDetailView key={query.data.updatedAt} user={query.data} />;
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border py-12 text-center">
      <p className="text-sm">{message}</p>
      <div className="flex gap-2">
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Coba lagi
          </Button>
        )}
        <Button variant="outline" render={<Link href="/users" />} nativeButton={false}>
          Kembali ke daftar user
        </Button>
      </div>
    </div>
  );
}

function UserDetailView({ user }: { user: ManagedUser }) {
  const me = useMe();
  const update = useUpdateUser(user.id);
  const setActive = useSetUserActive(user.id);
  const [confirm, setConfirm] = useState<"deactivate" | "activate" | null>(null);

  const isSelf = me.data?.id === user.id;

  // mutateAsync (bukan mutate + callback): setelah berhasil, data dimuat ulang dan tampilan ini
  // di-remount lewat `key`, sehingga callback milik mutate() tidak akan dipanggil lagi.
  const onSubmit = async (values: UserFormValues) => {
    try {
      await update.mutateAsync({
        name: values.name,
        email: values.email,
        role: values.role,
        // Untuk Owner/Admin Cabang backend mengosongkan cabang sendiri.
        ...(values.role === "PEGAWAI_CABANG"
          ? { branchId: values.branchId ? Number(values.branchId) : null }
          : {}),
        ...(values.password ? { password: values.password } : {}),
      });
      toast.success("Data user disimpan.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const toggle = async (active: boolean) => {
    try {
      await setActive.mutateAsync(active);
      toast.success(active ? "User diaktifkan." : "User dinonaktifkan.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setConfirm(null);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/users" />}
        nativeButton={false}
        className="-ml-2"
      >
        <ArrowLeft />
        Daftar user
      </Button>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {user.name}
            <Badge variant="outline">{ROLE_LABEL[user.role]}</Badge>
            <ActiveBadge active={user.isActive} />
            {isSelf && <Badge variant="secondary">Akun Anda</Badge>}
          </span>
        }
        actions={
          user.isActive ? (
            <Button
              variant="destructive"
              disabled={isSelf}
              title={isSelf ? "Anda tidak dapat menonaktifkan akun sendiri" : undefined}
              onClick={() => setConfirm("deactivate")}
            >
              Nonaktifkan
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setConfirm("activate")}>
              Aktifkan
            </Button>
          )
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Data user</CardTitle>
        </CardHeader>
        <CardContent>
          <UserForm mode="edit" user={user} pending={update.isPending} onSubmit={onSubmit} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirm === "deactivate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Nonaktifkan ${user.name}?`}
        description="User tidak dapat login lagi sampai diaktifkan kembali. Riwayat transaksinya tetap tersimpan."
        confirmLabel="Nonaktifkan"
        destructive
        pending={setActive.isPending}
        onConfirm={() => toggle(false)}
      />
      <ConfirmDialog
        open={confirm === "activate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Aktifkan ${user.name}?`}
        description="User dapat login kembali."
        confirmLabel="Aktifkan"
        pending={setActive.isPending}
        onConfirm={() => toggle(true)}
      />
    </div>
  );
}
