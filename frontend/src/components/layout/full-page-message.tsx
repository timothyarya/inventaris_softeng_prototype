import { Loader2 } from "lucide-react";

export function FullPageLoading({ label = "Memuat…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="text-muted-foreground flex min-h-svh items-center justify-center gap-2 text-sm"
    >
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}
