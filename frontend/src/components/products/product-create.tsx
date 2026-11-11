"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/data/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateProduct } from "@/hooks/use-products";
import { getErrorMessage } from "@/lib/apiClient";
import { ProductForm } from "./product-form";

export function ProductCreate() {
  const router = useRouter();
  const create = useCreateProduct();

  return (
    <div className="max-w-xl space-y-4">
      <PageHeader title="Tambah Produk" />
      <Card>
        <CardContent>
          <ProductForm
            mode="create"
            pending={create.isPending}
            onSubmit={(input) =>
              create.mutate(input, {
                onSuccess: (product) => {
                  toast.success(`Produk ${product.sku} berhasil dibuat.`);
                  router.push(`/produk/${product.id}`);
                },
                onError: (error) => toast.error(getErrorMessage(error)),
              })
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
