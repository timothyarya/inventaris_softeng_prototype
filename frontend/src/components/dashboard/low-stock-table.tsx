import { Inbox } from "lucide-react";
import Link from "next/link";
import { StockLevelBadge, stockQtyClass } from "@/components/stocks/stock-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBranch, formatNumber } from "@/lib/format";
import type { DashboardProblemItem } from "@/lib/types";

/**
 * Stok yang perlu perhatian: Habis dulu, lalu yang paling jauh di bawah minimum (maksimal 10
 * baris). `showBranch` untuk Owner/Admin Gudang; Pegawai Cabang hanya melihat cabangnya sendiri.
 */
export function LowStockTable({
  items,
  total,
  showBranch,
  moreHref,
}: {
  items: DashboardProblemItem[];
  /** Jumlah seluruh item menipis + habis (kartu), untuk teks "dari N". */
  total: number;
  showBranch: boolean;
  moreHref: string;
}) {
  return (
    <Card data-testid="dashboard-low-stock">
      <CardHeader>
        <CardTitle>Stok menipis dan habis</CardTitle>
        <CardDescription>
          {items.length > 0
            ? `Menampilkan ${formatNumber(items.length)} dari ${formatNumber(total)} item, yang paling mendesak dulu.`
            : "Item stok yang di bawah minimum atau habis."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
            <Inbox className="size-8" />
            <p className="text-foreground text-sm font-medium">Semua stok aman</p>
            <p className="text-sm">Tidak ada produk yang menipis atau habis.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {showBranch && <TableHead>Cabang</TableHead>}
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right max-md:hidden">Minimum</TableHead>
                  <TableHead className="max-md:hidden">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={`${i.branch.id}-${i.product.id}`}>
                    {showBranch && (
                      <TableCell>
                        <span className="max-md:hidden">{formatBranch(i.branch)}</span>
                        <span className="md:hidden">{i.branch.code}</span>
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="font-medium">{i.product.name}</span>
                      <span className="text-muted-foreground block font-mono text-xs">
                        {i.product.sku}
                      </span>
                      <span className="mt-1 block md:hidden">
                        <StockLevelBadge status={i.status} />
                      </span>
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${stockQtyClass(i.status)}`}>
                      {formatNumber(i.qty)} {i.product.unit}
                      <span className="text-muted-foreground block text-xs font-normal md:hidden">
                        Min {formatNumber(i.product.minStock)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums max-md:hidden">
                      {formatNumber(i.product.minStock)}
                    </TableCell>
                    <TableCell className="max-md:hidden">
                      <StockLevelBadge status={i.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {total > items.length && (
          <Link href={moreHref} className="text-sm font-medium hover:underline">
            Lihat semua stok
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
