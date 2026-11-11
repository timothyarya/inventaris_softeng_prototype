import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <FileQuestion className="text-muted-foreground size-10" />
      <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Halaman ini belum tersedia atau alamatnya salah.
      </p>
      <Button render={<Link href="/dashboard" />} nativeButton={false}>
        Kembali ke Dashboard
      </Button>
    </div>
  );
}
