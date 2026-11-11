"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { DataTable, type Column } from "@/components/data/data-table";
import { FormField } from "@/components/data/form-field";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/hooks/use-categories";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { getErrorMessage } from "@/lib/apiClient";
import { formatNumber } from "@/lib/format";
import type { Category } from "@/lib/types";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama kategori wajib diisi")
    .max(100, "Nama maksimal 100 karakter"),
});
type Values = z.infer<typeof schema>;

export function CategoryList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // null = dialog tertutup, "new" = tambah, Category = ubah.
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const q = useDebouncedValue(search.trim());
  const query = useCategories({ page, pageSize: 20, q: q || undefined });
  const remove = useDeleteCategory();

  const columns: Column<Category>[] = [
    { header: "Nama", cell: (c) => <span className="font-medium">{c.name}</span> },
    { header: "Jumlah produk", className: "text-right", cell: (c) => formatNumber(c.productCount) },
    {
      header: "Aksi",
      className: "w-px whitespace-nowrap text-right",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Ubah ${c.name}`}
            onClick={() => setEditing(c)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Hapus ${c.name}`}
            onClick={() => setDeleting(c)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  const onDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`Kategori ${deleting.name} dihapus.`);
        setDeleting(null);
      },
      onError: (error) => {
        toast.error(getErrorMessage(error));
        setDeleting(null);
      },
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kategori"
        description="Pengelompokan produk."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus />
            Tambah Kategori
          </Button>
        }
      />

      <div className="relative w-full max-w-xs">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Cari kategori…"
          className="pl-8"
          aria-label="Cari kategori"
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
        rowKey={(c) => c.id}
        emptyTitle="Belum ada kategori"
        emptyDescription="Tambahkan kategori untuk mengelompokkan produk."
      />

      {editing && (
        <CategoryDialog
          // key: form diinisialisasi ulang setiap kali dialog dibuka untuk kategori berbeda.
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Hapus kategori ${deleting?.name ?? ""}?`}
        description={
          deleting && deleting.productCount > 0
            ? `Kategori ini masih dipakai ${formatNumber(deleting.productCount)} produk, sehingga penghapusan akan ditolak.`
            : "Kategori dihapus permanen."
        }
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={onDelete}
      />
    </div>
  );
}

function CategoryDialog({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const pending = create.isPending || update.isPending;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: category?.name ?? "" },
  });

  const onSubmit = handleSubmit(({ name }) => {
    const callbacks = {
      onSuccess: () => {
        toast.success(category ? "Kategori disimpan." : "Kategori ditambahkan.");
        onClose();
      },
      onError: (error: unknown) => toast.error(getErrorMessage(error)),
    };
    if (category) update.mutate({ id: category.id, name }, callbacks);
    else create.mutate({ name }, callbacks);
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{category ? "Ubah Kategori" : "Tambah Kategori"}</DialogTitle>
          </DialogHeader>
          <FormField label="Nama kategori" htmlFor="category-name" error={errors.name?.message}>
            <Input
              id="category-name"
              autoComplete="off"
              autoFocus
              aria-invalid={errors.name ? true : undefined}
              {...register("name")}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
