"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { FormField } from "@/components/data/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useActiveBranches } from "@/hooks/use-branches";
import { ROLE_LABEL, type Role } from "@/lib/auth";
import { formatBranch } from "@/lib/format";
import type { ManagedUser } from "@/lib/types";
import { userCreateSchema, userEditSchema, type UserFormValues } from "./user-schema";

const ROLES: Role[] = ["OWNER", "ADMIN_GUDANG", "PEGAWAI_CABANG"];

export function UserForm({
  mode,
  user,
  lockRole = false,
  pending,
  onSubmit,
}: {
  mode: "create" | "edit";
  user?: ManagedUser;
  /** Akun sendiri: role tidak boleh diubah (hanya ditampilkan). */
  lockRole?: boolean;
  pending: boolean;
  onSubmit: (values: UserFormValues) => void;
}) {
  const branches = useActiveBranches();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<UserFormValues>({
    resolver: zodResolver(mode === "create" ? userCreateSchema : userEditSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      password: "",
      role: user?.role ?? "PEGAWAI_CABANG",
      branchId: user?.branchId ? String(user.branchId) : "",
    },
  });

  const role = useWatch({ control, name: "role" });
  // Gudang utama tidak boleh punya pegawai (aturan 4.2), jadi tidak ditawarkan.
  const options = (branches.data?.data ?? []).filter((b) => !b.isMain);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField label="Nama" htmlFor="name" error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          {...register("name")}
        />
      </FormField>
      <FormField label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          aria-invalid={errors.email ? true : undefined}
          {...register("email")}
        />
      </FormField>
      <FormField
        label={mode === "create" ? "Password" : "Password baru (opsional)"}
        htmlFor="password"
        error={errors.password?.message}
        hint={
          mode === "create"
            ? "Minimal 8 karakter."
            : "Kosongkan bila password tidak diubah. Minimal 8 karakter."
        }
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          {...register("password")}
        />
      </FormField>
      <FormField
        label="Role"
        htmlFor="role"
        error={errors.role?.message}
        hint={
          lockRole
            ? "Role akun Anda sendiri tidak dapat diubah agar Anda tidak kehilangan akses."
            : role === "PEGAWAI_CABANG"
              ? undefined
              : "Owner dan Admin Gudang tidak terikat cabang; penugasan cabang akan dikosongkan."
        }
      >
        {lockRole ? (
          // Bukan field form: nilai role tetap dari defaultValues dan dikirim apa adanya.
          <p id="role" className="text-sm font-medium">
            {ROLE_LABEL[role]}
          </p>
        ) : (
          <NativeSelect id="role" {...register("role")}>
            {ROLES.map((r) => (
              <NativeSelectOption key={r} value={r}>
                {ROLE_LABEL[r]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FormField>
      {role === "PEGAWAI_CABANG" && (
        <FormField
          label="Cabang"
          htmlFor="branchId"
          error={errors.branchId?.message}
          hint="Pegawai Cabang yang belum ditugaskan hanya melihat halaman menunggu penugasan."
        >
          <NativeSelect id="branchId" disabled={branches.isPending} {...register("branchId")}>
            <NativeSelectOption value="">Belum ditugaskan</NativeSelectOption>
            {options.map((b) => (
              <NativeSelectOption key={b.id} value={String(b.id)}>
                {formatBranch(b)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || (mode === "edit" && !isDirty)}>
          {pending && <Loader2 className="animate-spin" />}
          {mode === "create" ? "Simpan" : "Simpan perubahan"}
        </Button>
        {mode === "create" && (
          <Button variant="outline" render={<Link href="/users" />} nativeButton={false}>
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}
