"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStockIn } from "@/hooks/use-stock-ins";
import { getErrorMessage } from "@/lib/apiClient";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";

export function StockInDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const query = useStockIn(valid ? id : 0);

  if (!valid) return <ErrorState message="Stok masuk tidak ditemukan." />;

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full max-w-3xl" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />
    );
  }

  const doc = query.data;

  return (
    <div className="max-w-3xl space-y-4">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/stok-masuk" />}
        nativeButton={false}
        className="-ml-2"
      >
        <ArrowLeft />
        Daftar stok masuk
      </Button>

      <PageHeader
        title={<span className="font-mono">{doc.docNo}</span>}
        description="Dokumen final: tidak dapat diubah atau dihapus. Koreksi dilakukan lewat stok opname gudang."
      />

      <Card>
        <CardHeader>
          <CardTitle>Data dokumen</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Info label="Tanggal" value={formatDate(doc.date)} />
            <Info label="Supplier" value={doc.supplierName} />
            <Info label="No. faktur" value={doc.invoiceNo ?? "—"} />
            <Info label="Tujuan" value="Gudang utama" />
            <Info label="Dibuat oleh" value={doc.createdBy.name} />
            <Info label="Dibuat pada" value={formatDateTime(doc.createdAt)} />
            <div className="sm:col-span-2">
              <Info label="Catatan" value={doc.note ?? "—"} />
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item ({formatNumber(doc.itemCount)})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doc.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.product.sku}</TableCell>
                    <TableCell>
                      <Link href={`/produk/${item.product.id}`} className="hover:underline">
                        {item.product.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.qty)} {item.product.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-medium">
                    Total qty
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatNumber(doc.totalQty)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border py-12 text-center">
      <p className="text-sm">{message}</p>
      <div className="flex gap-2">
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Coba lagi
          </Button>
        )}
        <Button variant="outline" render={<Link href="/stok-masuk" />} nativeButton={false}>
          Kembali ke daftar stok masuk
        </Button>
      </div>
    </div>
  );
}
