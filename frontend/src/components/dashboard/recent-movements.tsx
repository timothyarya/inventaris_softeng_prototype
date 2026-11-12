import { Inbox } from "lucide-react";
import Link from "next/link";
import { docHref, signedQty, TYPE_CLASS, TYPE_LABEL } from "@/components/movements/movement-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBranch, formatDateTime, formatNumber } from "@/lib/format";
import type { Movement } from "@/lib/types";

/** 10 pergerakan stok terbaru (bagian 4.9), format daftar yang ringkas agar muat di layar kecil. */
export function RecentMovements({
  movements,
  isAdmin,
}: {
  movements: Movement[];
  isAdmin: boolean;
}) {
  return (
    <Card data-testid="dashboard-movements">
      <CardHeader>
        <CardTitle>Pergerakan stok terbaru</CardTitle>
        <CardDescription>10 pergerakan terakhir, terbaru dulu.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {movements.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
            <Inbox className="size-8" />
            <p className="text-foreground text-sm font-medium">Belum ada pergerakan stok</p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {movements.map((m) => {
              const href = docHref(m, isAdmin);
              return (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-3 px-3 py-2.5"
                  data-testid="dashboard-movement-row"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium">{m.product.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(m.createdAt)}
                      {isAdmin && ` · ${formatBranch(m.branch)}`}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <Badge variant="secondary" className={TYPE_CLASS[m.type]}>
                        {TYPE_LABEL[m.type]}
                      </Badge>
                      {href ? (
                        <Link href={href} className="font-mono font-medium hover:underline">
                          {m.refDocNo}
                        </Link>
                      ) : (
                        <span className="font-mono">{m.refDocNo}</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={
                        m.qty > 0
                          ? "text-sm font-semibold text-emerald-700 tabular-nums dark:text-emerald-400"
                          : "text-destructive text-sm font-semibold tabular-nums"
                      }
                    >
                      {signedQty(m.qty)} {m.product.unit}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      Saldo {formatNumber(m.balanceAfter)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/riwayat" className="text-sm font-medium hover:underline">
          Lihat semua riwayat
        </Link>
      </CardContent>
    </Card>
  );
}
