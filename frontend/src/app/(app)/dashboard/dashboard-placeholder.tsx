"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/hooks/use-auth";
import { ROLE_LABEL } from "@/lib/auth";

// Placeholder Fase 1. Isi dashboard (bagian 4.9) dikerjakan di Fase 7.
export function DashboardPlaceholder() {
  const { data: user } = useMe();
  if (!user) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Selamat datang, {user.name}</CardTitle>
          <CardDescription>
            {ROLE_LABEL[user.role]}
            {user.branch ? ` · ${user.branch.name} (${user.branch.code})` : " · Semua cabang"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Ringkasan dashboard akan tersedia di Fase 7.
        </CardContent>
      </Card>
    </div>
  );
}
