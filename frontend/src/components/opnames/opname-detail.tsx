"use client";

import { ArrowLeft, Check, Info as InfoIcon, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { PageHeader } from "@/components/data/page-header";
import { RejectDialog } from "@/components/transfers/reject-dialog";
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
import { useMe } from "@/hooks/use-auth";
import { useApproveOpname, useOpname, useRejectOpname } from "@/hooks/use-opnames";
import { getErrorMessage } from "@/lib/apiClient";
import { ROLE_LABEL, type Role } from "@/lib/auth";
import { formatBranch, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { OpnameDetail } from "@/lib/types";
import { OpnameStatusBadge, differenceClass, formatDifference } from "./opname-status";

type Dialogs = "approve" | "reject" | null;

export function OpnameDetailView() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const query = useOpname(valid ? id : 0);
  const me = useMe();
  const role = me.data?.role;

  if (!valid) return <ErrorState message="Opname tidak ditemukan." />;

  if (query.isPending || !role) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full max-w-4xl" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />
    );
  }

  return <Content opname={query.data} role={role} />;
}

function Content({ opname: o, role }: { opname: OpnameDetail; role: Role }) {
  const [dialog, setDialog] = useState<Dialogs>(null);
  const approve = useApproveOpname(o.id);
  const reject = useRejectOpname(o.id);
  const isAdmin = role !== "PEGAWAI_CABANG";

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      setDialog(null);
      toast.success(success);
    } catch (error) {
      // Dialog ditutup agar pesan galat terlihat jelas; 422 menyebut produk yang stoknya kurang.
      setDialog(null);
      toast.error(getErrorMessage(error), { duration: 10_000 });
    }
  };

  const diffItems = o.items.filter((i) => i.difference !== 0);
  const totalSystem = o.items.reduce((s, i) => s + i.qtySystem, 0);
  const totalPhysical = o.items.reduce((s, i) => s + i.qtyPhysical, 0);

  const verifierNames = o.verifierRoles.map((r) => ROLE_LABEL[r]).join(" atau ");

  return (
    <div className="max-w-4xl space-y-4">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/opname" />}
        nativeButton={false}
        className="-ml-2"
      >
        <ArrowLeft />
        Daftar opname
      </Button>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{o.docNo}</span>
            <OpnameStatusBadge status={o.status} />
          </span>
        }
        description={statusHint(o, role)}
        actions={
          o.canVerify && (
            <>
              <Button onClick={() => setDialog("approve")}>
                <Check />
                Setujui
              </Button>
              <Button variant="destructive" onClick={() => setDialog("reject")}>
                <X />
                Tolak
              </Button>
            </>
          )
        }
      />

      {o.status === "MENUNGGU" && isAdmin && !o.canVerify && (
        <div
          role="note"
          className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200"
        >
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            Opname ini dibuat oleh {ROLE_LABEL[o.createdBy.role]} ({o.createdBy.name}), sehingga
            hanya <strong>{verifierNames}</strong> yang dapat menyetujui atau menolaknya.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Data dokumen</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Info label="Cabang" value={formatBranch(o.branch)} />
            <Info label="Tanggal penghitungan" value={formatDate(o.date)} />
            <Info
              label="Dibuat oleh"
              value={`${o.createdBy.name} (${ROLE_LABEL[o.createdBy.role]}) · ${formatDateTime(o.createdAt)}`}
            />
            {o.verifiedBy && o.verifiedAt ? (
              <Info
                label={o.status === "DITOLAK" ? "Ditolak oleh" : "Disetujui oleh"}
                value={`${o.verifiedBy.name} (${ROLE_LABEL[o.verifiedBy.role]}) · ${formatDateTime(o.verifiedAt)}`}
              />
            ) : (
              <Info label="Diverifikasi oleh" value="Belum diverifikasi" />
            )}
            <div className="sm:col-span-2">
              <Info label="Catatan" value={o.note ?? "—"} />
            </div>
            {o.verifyNote && (
              <div className="sm:col-span-2">
                <Info
                  label={o.status === "DITOLAK" ? "Alasan penolakan" : "Catatan verifikasi"}
                  value={o.verifyNote}
                />
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Item ({formatNumber(o.itemCount)}) · {formatNumber(o.diffItemCount)} berselisih
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Sistem</TableHead>
                  <TableHead className="text-right">Fisik</TableHead>
                  <TableHead className="text-right">Selisih</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.product.sku}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Link href={`/produk/${item.product.id}`} className="hover:underline">
                          {item.product.name}
                        </Link>
                      ) : (
                        item.product.name
                      )}
                      {!item.product.isActive && (
                        <span className="text-muted-foreground ml-2 text-xs">(nonaktif)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.qtySystem)} {item.product.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.qtyPhysical)} {item.product.unit}
                    </TableCell>
                    <TableCell className={`text-right ${differenceClass(item.difference)}`}>
                      {formatDifference(item.difference)}
                    </TableCell>
                    <TableCell className="whitespace-pre-wrap">{item.remark ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatNumber(totalSystem)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatNumber(totalPhysical)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${differenceClass(o.totalDifference)}`}
                  >
                    {formatDifference(o.totalDifference)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Setujui opname?"
        description={
          <div className="space-y-2">
            <p>
              Stok <strong>{formatBranch(o.branch)}</strong> akan disesuaikan untuk{" "}
              <strong>{formatNumber(diffItems.length)}</strong> produk yang berselisih (total{" "}
              {formatDifference(o.totalDifference)}). Selisih ditambahkan ke stok saat ini dan
              dicatat di riwayat stok.
            </p>
            <p>Tindakan ini tidak dapat dibatalkan.</p>
          </div>
        }
        confirmLabel="Setujui"
        pending={approve.isPending}
        onConfirm={() =>
          void run(() => approve.mutateAsync(), `Opname ${o.docNo} disetujui dan stok disesuaikan.`)
        }
      />
      <RejectDialog
        open={dialog === "reject"}
        onOpenChange={(open) => !open && setDialog(null)}
        docNo={o.docNo}
        pending={reject.isPending}
        title="Tolak opname?"
        description={
          <>
            Opname <span className="font-mono">{o.docNo}</span> akan ditolak dan stok tidak berubah.
            Pembuat dapat membuat opname baru setelahnya.
          </>
        }
        label="Catatan verifikasi"
        requiredMessage="Catatan verifikasi wajib diisi"
        onSubmit={(note) => void run(() => reject.mutateAsync(note), `Opname ${o.docNo} ditolak.`)}
      />
    </div>
  );
}

function statusHint(o: OpnameDetail, role: Role): string {
  const admin = role !== "PEGAWAI_CABANG";
  switch (o.status) {
    case "MENUNGGU":
      if (o.canVerify) {
        return "Menunggu keputusan Anda. Stok baru disesuaikan bila opname disetujui; penolakan wajib disertai catatan.";
      }
      return admin
        ? "Menunggu verifikasi. Stok belum berubah."
        : "Menunggu verifikasi Admin Gudang atau Owner. Stok belum berubah.";
    case "DISETUJUI":
      return "Selesai. Selisih sudah diterapkan ke stok cabang dan tercatat di riwayat stok.";
    case "DITOLAK":
      return "Opname ditolak. Stok tidak berubah; cabang dapat membuat opname baru.";
  }
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
        <Button variant="outline" render={<Link href="/opname" />} nativeButton={false}>
          Kembali ke daftar
        </Button>
      </div>
    </div>
  );
}
