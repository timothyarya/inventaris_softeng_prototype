import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tone = "default" | "warning" | "danger";

// Warna status dipakai hanya pada ikon (disertai label), angka tetap memakai warna teks biasa.
const ICON_CLASS: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function StatCard({
  label,
  hint,
  value,
  icon: Icon,
  tone = "default",
  testId,
}: {
  label: string;
  hint?: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
  testId: string;
}) {
  return (
    <Card size="sm" data-testid={testId}>
      <div className="flex items-start justify-between gap-3 px-(--card-spacing)">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="text-2xl font-semibold tabular-nums" data-slot="stat-value">
            {formatNumber(value)}
          </p>
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        </div>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            ICON_CLASS[tone],
          )}
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </span>
      </div>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card size="sm">
      <div className="space-y-2 px-(--card-spacing)">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>
    </Card>
  );
}
