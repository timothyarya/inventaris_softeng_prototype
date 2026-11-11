"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/data/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateUser } from "@/hooks/use-users";
import { getErrorMessage } from "@/lib/apiClient";
import { UserForm } from "./user-form";

export function UserCreate() {
  const router = useRouter();
  const create = useCreateUser();

  return (
    <div className="max-w-xl space-y-4">
      <PageHeader title="Tambah User" />
      <Card>
        <CardContent>
          <UserForm
            mode="create"
            pending={create.isPending}
            onSubmit={(values) =>
              create.mutate(
                {
                  name: values.name,
                  email: values.email,
                  password: values.password,
                  role: values.role,
                  branchId:
                    values.role === "PEGAWAI" && values.branchId ? Number(values.branchId) : null,
                },
                {
                  onSuccess: (user) => {
                    toast.success(`User ${user.name} berhasil dibuat.`);
                    router.push(`/users/${user.id}`);
                  },
                  onError: (error) => toast.error(getErrorMessage(error)),
                },
              )
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
