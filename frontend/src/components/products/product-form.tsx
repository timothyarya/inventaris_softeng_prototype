"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/data/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useAllCategories } from "@/hooks/use-categories";
import type { ProductInput } from "@/hooks/use-products";
import type { Product } from "@/lib/types";
import { productSchema, type ProductFormValues } from "./product-schema";

export function toProductInput(values: ProductFormValues): ProductInput {
  return {
    sku: values.sku,
    name: values.name,
    unit: values.unit,
    minStock: values.minStock,
    categoryId: values.categoryId ? Number(values.categoryId) : null,
  };
}

export function ProductForm({
  mode,
  product,
  pending,
  onSubmit,
}: {
  mode: "create" | "edit";
  product?: Product;
  pending: boolean;
  onSubmit: (input: ProductInput) => void;
}) {
  const categories = useAllCategories();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: product?.sku ?? "",
      name: product?.name ?? "",
      unit: product?.unit ?? "pcs",
      minStock: product?.minStock ?? 0,
      categoryId: product?.categoryId ? String(product.categoryId) : "",
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(toProductInput(values)))}
      noValidate
      className="space-y-4"
    >
      <FormField label="SKU" htmlFor="sku" error={errors.sku?.message} hint="Kode unik produk.">
        <Input
          id="sku"
          autoComplete="off"
          aria-invalid={errors.sku ? true : undefined}
          {...register("sku")}
        />
      </FormField>
      <FormField label="Nama produk" htmlFor="name" error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          {...register("name")}
        />
      </FormField>
      <FormField label="Kategori" htmlFor="categoryId" error={errors.categoryId?.message}>
        <NativeSelect id="categoryId" disabled={categories.isPending} {...register("categoryId")}>
          <NativeSelectOption value="">Tanpa kategori</NativeSelectOption>
          {categories.data?.data.map((c) => (
            <NativeSelectOption key={c.id} value={String(c.id)}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Satuan"
          htmlFor="unit"
          error={errors.unit?.message}
          hint="Contoh: pcs, kg, box."
        >
          <Input
            id="unit"
            autoComplete="off"
            aria-invalid={errors.unit ? true : undefined}
            {...register("unit")}
          />
        </FormField>
        <FormField
          label="Stok minimum"
          htmlFor="minStock"
          error={errors.minStock?.message}
          hint="0 berarti tidak dipantau sebagai stok menipis."
        >
          <Input
            id="minStock"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            aria-invalid={errors.minStock ? true : undefined}
            {...register("minStock", { valueAsNumber: true })}
          />
        </FormField>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || (mode === "edit" && !isDirty)}>
          {pending && <Loader2 className="animate-spin" />}
          {mode === "create" ? "Simpan" : "Simpan perubahan"}
        </Button>
        {mode === "create" && (
          <Button variant="outline" render={<Link href="/produk" />} nativeButton={false}>
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}
