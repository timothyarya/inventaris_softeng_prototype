"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { useActiveBranches, useBranches } from "@/hooks/use-branches";
import { useAllActiveProducts } from "@/hooks/use-products";
import { useBranchStockMap } from "@/hooks/use-stocks";
import { useCreateDirect, useCreateRequest } from "@/hooks/use-transfers";
import { useMe } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/apiClient";
import { formatBranch, formatNumber } from "@/lib/format";
import { MAX_ITEMS, transferFormSchema, type TransferFormValues } from "./transfer-schema";

const emptyItem = { productId: "", qty: undefined as unknown as number };

/**
 * Form dua mode:
 *  - "request": Pegawai Cabang meminta stok ke gudang utama untuk cabangnya (tanpa menampilkan stok gudang).
 *  - "direct": Owner/Admin Gudang mengirim langsung dari gudang utama ke cabang aktif (stok gudang ditampilkan).
 */
export function TransferCreate({ mode }: { mode: "request" | "direct" }) {
  const direct = mode === "direct";
  const router = useRouter();
  const me = useMe();
  const createRequest = useCreateRequest();
  const createDirect = useCreateDirect();
  const creating = direct ? createDirect.isPending : createRequest.isPending;
  const products = useAllActiveProducts();
  // GET /branches hanya untuk Owner/Admin Gudang; Pegawai Cabang memakai cabangnya sendiri (dari sesi).
  const activeBranches = useActiveBranches({ enabled: direct });
  const allBranches = useBranches({ page: 1, pageSize: 100 }, { enabled: direct });
  const mainBranch = allBranches.data?.data.find((b) => b.isMain);
  const warehouse = useBranchStockMap(direct ? mainBranch?.id : undefined);
  const [pending, setPending] = useState<TransferFormValues | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema(direct)),
    defaultValues: { toBranchId: "", note: "", items: [emptyItem] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const toBranchId = useWatch({ control, name: "toBranchId" });

  const productById = useMemo(
    () => new Map((products.data ?? []).map((p) => [String(p.id), p])),
    [products.data],
  );
  const chosen = new Set((items ?? []).map((i) => i?.productId).filter(Boolean));
  const totalQty = (items ?? []).reduce(
    (sum, i) => sum + (Number.isFinite(i?.qty) ? Number(i.qty) : 0),
    0,
  );
  const destinations = (activeBranches.data?.data ?? []).filter((b) => !b.isMain);
  const destination = direct
    ? destinations.find((b) => String(b.id) === toBranchId)
    : (me.data?.branch ?? undefined);

  const submit = async (values: TransferFormValues) => {
    const payload = {
      note: values.note || null,
      items: values.items.map((i) => ({ productId: Number(i.productId), qty: i.qty })),
    };
    try {
      const doc = direct
        ? await createDirect.mutateAsync({ ...payload, toBranchId: Number(values.toBranchId) })
        : await createRequest.mutateAsync(payload);
      toast.success(
        direct
          ? `Pengiriman ${doc.docNo} berhasil dibuat dan stok gudang berkurang.`
          : `Request ${doc.docNo} berhasil diajukan.`,
      );
      router.push(`/transfer/${doc.id}`);
    } catch (error) {
      setPending(null);
      toast.error(getErrorMessage(error));
    }
  };

  const cancelHref = direct ? "/transfer" : "/request-stok";

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={direct ? "Form Pengiriman" : "Buat Request Stok"}
        description={
          direct
            ? "Kirim barang langsung dari gudang utama ke cabang. Stok gudang langsung berkurang; cabang tujuan menambah stok saat mengonfirmasi penerimaan."
            : "Ajukan permintaan barang dari gudang utama ke cabang Anda. Stok baru berpindah setelah disetujui dan dikirim."
        }
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
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Dari</span>
              <p className="text-sm">{mainBranch ? formatBranch(mainBranch) : "Gudang utama"}</p>
            </div>
            {direct ? (
              <FormField
                label="Cabang tujuan"
                htmlFor="toBranchId"
                error={errors.toBranchId?.message}
              >
                <NativeSelect
                  id="toBranchId"
                  className="w-full"
                  disabled={activeBranches.isPending}
                  aria-invalid={errors.toBranchId ? true : undefined}
                  {...register("toBranchId")}
                >
                  <NativeSelectOption value="">
                    {activeBranches.isPending ? "Memuat cabang…" : "Pilih cabang tujuan"}
                  </NativeSelectOption>
                  {destinations.map((b) => (
                    <NativeSelectOption key={b.id} value={String(b.id)}>
                      {formatBranch(b)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
            ) : (
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Cabang tujuan</span>
                <p className="text-sm">{destination ? formatBranch(destination) : "—"}</p>
              </div>
            )}
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
              const available =
                selected && warehouse.data ? (warehouse.data[selected.id] ?? 0) : null;
              const rowQty = items?.[index]?.qty;
              const over =
                direct && available !== null && Number.isFinite(rowQty) && rowQty > available;
              return (
                <div
                  key={field.id}
                  className="grid items-start gap-2 sm:grid-cols-[1fr_9rem_auto]"
                  data-testid="item-row"
                >
                  <div className="space-y-1">
                    <NativeSelect
                      aria-label={`Produk item ${index + 1}`}
                      className="w-full"
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
                    {direct && selected && available !== null && (
                      <p
                        className={`text-xs ${over ? "text-destructive font-medium" : "text-muted-foreground"}`}
                        data-testid="warehouse-stock"
                      >
                        Stok gudang: {formatNumber(available)} {selected.unit}
                        {over && " — jumlah melebihi stok"}
                      </p>
                    )}
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
          <Button type="submit" disabled={creating}>
            {creating && <Loader2 className="animate-spin" />}
            {direct ? "Kirim" : "Ajukan Request"}
          </Button>
          <Button variant="outline" render={<Link href={cancelHref} />} nativeButton={false}>
            Batal
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={direct ? "Kirim barang sekarang?" : "Ajukan request?"}
        description={
          <div className="space-y-2">
            <p>
              {pending ? formatNumber(pending.items.length) : 0} item dengan total qty{" "}
              {formatNumber(totalQty)}
              {destination ? ` untuk ${formatBranch(destination)}` : ""}.
            </p>
            {direct ? (
              <p>
                Stok gudang utama langsung berkurang dan status menjadi Dikirim. Pengiriman tidak
                dapat dibatalkan.
              </p>
            ) : (
              <p>Request akan menunggu persetujuan Owner atau Admin Gudang.</p>
            )}
          </div>
        }
        confirmLabel={direct ? "Kirim" : "Ajukan"}
        pending={creating}
        onConfirm={() => pending && void submit(pending)}
      />
    </div>
  );
}
