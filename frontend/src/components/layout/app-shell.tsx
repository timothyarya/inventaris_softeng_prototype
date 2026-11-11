"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useMe } from "@/hooks/use-auth";
import { ApiError, getErrorMessage } from "@/lib/apiClient";
import { isAwaitingAssignment } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { Forbidden } from "./forbidden";
import { FullPageLoading } from "./full-page-message";

/**
 * Penjaga halaman + kerangka layout (sidebar + header). Hanya untuk UX:
 * backend tetap sumber kebenaran akses.
 * - belum login / sesi berakhir / akun nonaktif (401) -> /login
 * - Pegawai tanpa cabang -> /menunggu-penugasan
 * - route di luar hak role -> halaman 403
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const user = me.data;

  const unauthenticated = me.error instanceof ApiError && me.error.status === 401;
  const awaiting = user ? isAwaitingAssignment(user) : false;

  useEffect(() => {
    if (unauthenticated) router.replace("/login");
    else if (awaiting) router.replace("/menunggu-penugasan");
  }, [unauthenticated, awaiting, router]);

  if (me.isPending || unauthenticated || awaiting) return <FullPageLoading />;

  if (!user) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm">{getErrorMessage(me.error)}</p>
        <Button variant="outline" onClick={() => void me.refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Suspense fallback={null}>
        <AppSidebar user={user} />
      </Suspense>
      <SidebarInset>
        <AppHeader user={user} />
        <main className="flex-1 p-4 md:p-6">
          {canAccess(user.role, pathname) ? children : <Forbidden />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
