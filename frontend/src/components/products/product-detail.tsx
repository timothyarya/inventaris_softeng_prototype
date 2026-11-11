"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { PageHeader } from "@/components/data/page-header";
import { ActiveBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteProduct,
  useProduct,
  useSetProductActive,
  useUpdateProduct,
} from "@/hooks/use-products";
import type { ProductInput } from "@/hooks/use-products";
import { getErrorMessage } from "@/lib/apiClient";
import type { Product } from "@/lib/types";
import { ProductForm } from "./product-form";

export function ProductDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const query = useProduct(valid ? id : 0);

  if (!valid) return <ErrorState message="Produk tidak ditemukan." />;

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
  return <ProductDetailView key={query.data.updatedAt} product={query.data} />;
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
        <Button variant="outline" render={<Link href="/produk" />} nativeButton={false}>
          Kembali ke daftar produk
        </Button>
      </div>
    </div>
  );
}

function ProductDetailView({ product }: { product: Product }) {
  const router = useRouter();
  const update = useUpdateProduct(product.id);
  const setActive = useSetProductActive(product.id);
  const remove = useDeleteProduct(product.id);
  const [confirm, setConfirm] = useState<"deactivate" | "activate" | "delete" | null>(null);

  // mutateAsync (bukan mutate + callback): setelah berhasil, data dimuat ulang dan tampilan ini
  // di-remount lewat `key`, sehingga callback milik mutate() tidak akan dipanggil lagi.
  const onUpdate = async (input: ProductInput) => {
    try {
      await update.mutateAsync(input);
      toast.success("Data produk disimpan.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const toggle = async (active: boolean) => {
    try {
      await setActive.mutateAsync(active);
      toast.success(active ? "Produk diaktifkan." : "Produk dinonaktifkan.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setConfirm(null);
    }
  };

  const onDelete = async () => {
    try {
      await remove.mutateAsync();
    } catch (error) {
      // Produk yang sudah punya riwayat/dokumen ditolak backend; pesannya menyarankan nonaktifkan.
      setConfirm(null);
      toast.error(getErrorMessage(error));
      return;
    }
    toast.success(`Produk ${product.sku} dihapus.`);
    router.replace("/produk");
  };

  return (
    <div className="max-w-xl space-y-4">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/produk" />}
        nativeButton={false}
        className="-ml-2"
      >
        <ArrowLeft />
        Daftar produk
      </Button>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {product.name}
            <ActiveBadge active={product.isActive} />
          </span>
        }
        description={<span className="font-mono">{product.sku}</span>}
        actions={
          <>
            {product.isActive ? (
              <Button variant="outline" onClick={() => setConfirm("deactivate")}>
                Nonaktifkan
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setConfirm("activate")}>
                Aktifkan
              </Button>
            )}
            <Button variant="destructive" onClick={() => setConfirm("delete")}>
              Hapus
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Data produk</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm
            mode="edit"
            product={product}
            pending={update.isPending}
            onSubmit={(input) => void onUpdate(input)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stok per cabang</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Stok per cabang akan ditampilkan setelah fitur stok tersedia.
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirm === "deactivate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Nonaktifkan ${product.name}?`}
        description="Produk nonaktif tidak bisa dipilih untuk transaksi baru. Riwayat dan stok yang ada tetap tersimpan."
        confirmLabel="Nonaktifkan"
        destructive
        pending={setActive.isPending}
        onConfirm={() => toggle(false)}
      />
      <ConfirmDialog
        open={confirm === "activate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Aktifkan ${product.name}?`}
        description="Produk dapat dipakai kembali untuk transaksi."
        confirmLabel="Aktifkan"
        pending={setActive.isPending}
        onConfirm={() => toggle(true)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Hapus ${product.name}?`}
        description="Produk dihapus permanen. Produk yang sudah punya riwayat stok atau dokumen tidak dapat dihapus; nonaktifkan saja."
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={onDelete}
      />
    </div>
  );
}
