"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/data/form-field";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCreateBranch } from "@/hooks/use-branches";
import { getErrorMessage } from "@/lib/apiClient";
import { branchCreateSchema, emptyToNull, type BranchCreateValues } from "./branch-schema";

export function BranchCreateForm() {
  const router = useRouter();
  const create = useCreateBranch();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchCreateValues>({
    resolver: zodResolver(branchCreateSchema),
    defaultValues: { code: "", name: "", address: "", phone: "" },
  });

  const onSubmit = handleSubmit((values) => {
    create.mutate(
      {
        code: values.code.toUpperCase(),
        name: values.name,
        address: emptyToNull(values.address),
        phone: emptyToNull(values.phone),
      },
      {
        onSuccess: (branch) => {
          toast.success(`Cabang ${branch.code} — ${branch.name} berhasil dibuat.`);
          router.push(`/cabang/${branch.id}`);
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  });

  return (
    <div className="max-w-xl space-y-4">
      <PageHeader title="Tambah Cabang" />
      <Card>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField
              label="Kode cabang"
              htmlFor="code"
              error={errors.code?.message}
              hint="Huruf besar dan angka, 2–20 karakter. Kode tidak dapat diubah setelah dibuat."
            >
              <Input
                id="code"
                autoComplete="off"
                className="uppercase"
                aria-invalid={errors.code ? true : undefined}
                {...register("code")}
              />
            </FormField>
            <FormField label="Nama cabang" htmlFor="name" error={errors.name?.message}>
              <Input
                id="name"
                autoComplete="off"
                aria-invalid={errors.name ? true : undefined}
                {...register("name")}
              />
            </FormField>
            <FormField label="Alamat (opsional)" htmlFor="address" error={errors.address?.message}>
              <Input id="address" autoComplete="off" {...register("address")} />
            </FormField>
            <FormField label="Telepon (opsional)" htmlFor="phone" error={errors.phone?.message}>
              <Input id="phone" autoComplete="off" {...register("phone")} />
            </FormField>
            <div className="flex gap-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="animate-spin" />}
                Simpan
              </Button>
              <Button variant="outline" render={<Link href="/cabang" />} nativeButton={false}>
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
