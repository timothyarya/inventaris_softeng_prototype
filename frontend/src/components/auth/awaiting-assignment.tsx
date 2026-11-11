"use client";

import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageLoading } from "@/components/layout/full-page-message";
import { LogoutButton } from "@/components/layout/logout-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/hooks/use-auth";
import { ApiError } from "@/lib/apiClient";
import { isAwaitingAssignment } from "@/lib/auth";

/** Halaman khusus Pegawai Cabang yang belum/tidak punya cabang (bagian 3.1). */
export function AwaitingAssignment() {
  const router = useRouter();
  const me = useMe();
  const user = me.data;

  const unauthenticated = me.error instanceof ApiError && me.error.status === 401;
  const shouldLeave = user ? !isAwaitingAssignment(user) : false;

  useEffect(() => {
    if (unauthenticated) router.replace("/login");
    else if (shouldLeave) router.replace("/dashboard");
  }, [unauthenticated, shouldLeave, router]);

  if (!user || shouldLeave) return <FullPageLoading />;

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <Clock className="text-muted-foreground size-10" />
          <CardTitle className="text-xl">Menunggu penugasan cabang</CardTitle>
          <CardDescription>
            Halo, {user.name}. Akun Anda belum ditugaskan ke cabang mana pun.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Silakan hubungi Owner untuk mendapatkan penugasan cabang. Setelah ditugaskan, muat ulang
            halaman ini atau masuk kembali.
          </p>
          <LogoutButton />
        </CardContent>
      </Card>
    </main>
  );
}
