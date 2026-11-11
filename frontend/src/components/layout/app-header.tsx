"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ROLE_LABEL, type AuthUser } from "@/lib/auth";
import { LogoutButton } from "./logout-button";

export function AppHeader({ user }: { user: AuthUser }) {
  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-5 data-vertical:self-center" />
      <div className="ml-auto flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-muted-foreground text-xs">
            {ROLE_LABEL[user.role]}
            {user.role === "PEGAWAI" && user.branch ? ` · ${user.branch.name}` : ""}
          </div>
        </div>
        <LogoutButton compact />
      </div>
    </header>
  );
}
