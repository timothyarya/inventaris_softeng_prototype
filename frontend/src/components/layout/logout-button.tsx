"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/use-auth";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const logout = useLogout();

  return (
    <Button
      variant="outline"
      size={compact ? "icon" : "default"}
      disabled={logout.isPending}
      aria-label="Keluar"
      title="Keluar"
      onClick={() => logout.mutate(undefined, { onSettled: () => router.replace("/login") })}
    >
      <LogOut />
      {!compact && <span>Keluar</span>}
    </Button>
  );
}
