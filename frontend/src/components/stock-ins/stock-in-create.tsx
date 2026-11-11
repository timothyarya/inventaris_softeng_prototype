"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { FormField } from "@/components/data/form-field";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateStockIn } from "@/hooks/use-stock-ins";
import { useAllActiveProducts } from "@/hooks/use-products";
import { getErrorMessage } from "@/lib/apiClient";
import { formatNumber, todayJakarta } from "@/lib/format";
import { MAX_ITEMS, stockInSchema, type StockInFormValues } from "./stock-in-schema";

const emptyItem = { productId: "", qty: undefined as unknown as number };

export function StockInCreate() {
  const router = useRouter();
  const create = useCreateStockIn();
  const products = useAllActiveProducts();
  const [pending, setPending] = useState<StockInFormValues | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<StockInFormValues>({
    resolver: zodResolver(stockInSchema),
    defaultValues: {
      date: todayJakarta(),
      supplierName: "",
      invoiceNo: "",
      note: "",
      items: [emptyItem],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });

  const productById = new Map((products.data ?? []).map((p) => [String(p.id), p]));
  const chosen = new Set((items ?? []).map((i) => i?.productId).filter(Boolean));
  const totalQty = (items ?? []).reduce(
    (sum, i) => sum + (Number.isFinite(i?.qty) ? Number(i.qty) : 0),
    0,
  );

  const submit = async (values: StockInFormValues) => {
    try {
      const doc = await create.mutateAsync({
        date: values.date,
        supplierName: values.supplierName,
        invoiceNo: values.invoiceNo || null,
        note: values.note || null,
        items: values.items.map((i) => ({ productId: Number(i.productId), qty: i.qty })),
      });
      toast.success(`Stok masuk ${doc.docNo} berhasil disimpan.`);
      router.push(`/stok-masuk/${doc.id}`);
    } catch (error) {
      setPending(null);
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title="Tambah Stok Masuk"
        description="Barang dari supplier selalu masuk ke gudang utama. Nomor dokumen dibuat otomatis."
      />

      <form
        onSubmit={handleSubmit((values) => setPending(values))}
        noValidate
        className="space-y-4"
      >
        <Card>
          <CardHeader>
            <CardTitle>Data dokumen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Tanggal" htmlFor="date" error={errors.date?.message}>
              <Input
                id="date"
                type="date"
                max={todayJakarta()}
                aria-invalid={errors.date ? true : undefined}
                {...register("date")}
              />
            </FormField>
            <FormField
              label="Nama supplier"
              htmlFor="supplierName"
              error={errors.supplierName?.message}
            >
              <Input
                id="supplierName"
                autoComplete="off"
                aria-invalid={errors.supplierName ? true : undefined}
                {...register("supplierName")}
              />
            </FormField>
            <FormField
              label="No. faktur (opsional)"
              htmlFor="invoiceNo"
              error={errors.invoiceNo?.message}
            >
              <Input id="invoiceNo" autoComplete="off" {...register("invoiceNo")} />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Catatan (opsional)" htmlFor="note" error={errors.note?.message}>
                <Textarea id="note" rows={2} {...register("note")} />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daftar item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {products.error && (
              <p className="text-destructive text-sm">
                {getErrorMessage(products.error)}{" "}
                <button type="button" className="underline" onClick={() => void products.refetch()}>
                  Coba lagi
                </button>
              </p>
            )}
            {fields.map((field, index) => {
              const selected = productById.get(items?.[index]?.productId ?? "");
              const rowErrors = errors.items?.[index];
              return (
                <div
                  key={field.id}
                  className="grid items-start gap-2 sm:grid-cols-[1fr_9rem_auto]"
                  data-testid="item-row"
                >
                  <div className="space-y-1">
                    <NativeSelect
                      aria-label={`Produk item ${index + 1}`}
                      disabled={products.isPending}
                      aria-invalid={rowErrors?.productId ? true : undefined}
                      {...register(`items.${index}.productId`)}
                    >
                      <NativeSelectOption value="">
                        {products.isPending ? "Memuat produk…" : "Pilih produk"}
                      </NativeSelectOption>
                      {products.data?.map((p) => (
                        <NativeSelectOption
                          key={p.id}
                          value={String(p.id)}
                          // Produk yang sudah dipilih di baris lain tidak ditawarkan lagi.
                          disabled={
                            chosen.has(String(p.id)) && items?.[index]?.productId !== String(p.id)
                          }
                        >
                          {p.sku} — {p.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {rowErrors?.productId && (
                      <p className="text-destructive text-sm">{rowErrors.productId.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        placeholder="Qty"
                        aria-label={`Qty item ${index + 1}`}
                        aria-invalid={rowErrors?.qty ? true : undefined}
                        {...register(`items.${index}.qty`, { valueAsNumber: true })}
                      />
                      <span className="text-muted-foreground w-10 text-sm">{selected?.unit}</span>
                    </div>
                    {rowErrors?.qty && (
                      <p className="text-destructive text-sm">{rowErrors.qty.message}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus item ${index + 1}`}
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}

            {errors.items?.message && (
              <p className="text-destructive text-sm">{errors.items.message}</p>
            )}
            {errors.items?.root?.message && (
              <p className="text-destructive text-sm">{errors.items.root.message}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={fields.length >= MAX_ITEMS}
                onClick={() => append(emptyItem)}
              >
                <Plus />
                Tambah item
              </Button>
              <p className="text-sm">
                {formatNumber(fields.length)} item · total qty{" "}
                <span className="font-semibold">{formatNumber(totalQty)}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />}
            Simpan
          </Button>
          <Button variant="outline" render={<Link href="/stok-masuk" />} nativeButton={false}>
            Batal
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Simpan stok masuk?"
        description={
          <div className="space-y-2">
            <p>
              {pending ? formatNumber(pending.items.length) : 0} item dengan total qty{" "}
              {formatNumber(totalQty)} akan menambah stok gudang utama.
            </p>
            <p>Dokumen yang sudah disimpan bersifat final: tidak dapat diubah atau dihapus.</p>
          </div>
        }
        confirmLabel="Simpan"
        pending={create.isPending}
        onConfirm={() => pending && void submit(pending)}
      />
    </div>
  );
}
