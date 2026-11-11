import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Forbidden() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <ShieldAlert className="text-muted-foreground size-10" />
      <h1 className="text-2xl font-semibold">403 — Akses ditolak</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Anda tidak memiliki akses ke halaman ini.
      </p>
      <Button render={<Link href="/dashboard" />} nativeButton={false}>
        Kembali ke Dashboard
      </Button>
    </div>
  );
}
