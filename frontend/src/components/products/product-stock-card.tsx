"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStocks } from "@/hooks/use-stocks";
import { getErrorMessage } from "@/lib/apiClient";
import { formatBranch, formatNumber } from "@/lib/format";
import { StockStatusBadge } from "@/components/stocks/stock-list";

/** Stok satu produk di semua cabang aktif (bagian 9: /produk/[id]). */
export function ProductStockCard({ productId }: { productId: number }) {
  const query = useStocks({ page: 1, pageSize: 100, productId });
  const rows = query.data?.data ?? [];
  const total = rows.reduce((sum, r) => sum + r.qty, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stok per cabang</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : query.error ? (
          <div className="space-y-2 text-sm">
            <p>{getErrorMessage(query.error)}</p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              Coba lagi
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Belum ada cabang aktif.</p>
        ) : (
          <div className="space-y-3">
            <ul className="divide-y text-sm">
              {rows.map((r) => (
                <li key={r.branch.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/stok`} className="hover:underline">
                    {formatBranch(r.branch)}
                  </Link>
                  <span className="flex items-center gap-3">
                    <span className={r.isLow ? "text-destructive font-semibold" : "font-medium"}>
                      {formatNumber(r.qty)} {r.product.unit}
                    </span>
                    <StockStatusBadge row={r} />
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm">
              Total semua cabang: <span className="font-semibold">{formatNumber(total)}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
