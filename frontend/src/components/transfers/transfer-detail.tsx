"use client";

import { ArrowLeft, Check, PackageCheck, Send, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
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
import { useMe } from "@/hooks/use-auth";
import {
  useApproveTransfer,
  useCancelTransfer,
  useReceiveTransfer,
  useRejectTransfer,
  useSendTransfer,
  useTransfer,
} from "@/hooks/use-transfers";
import { getErrorMessage } from "@/lib/apiClient";
import type { Role } from "@/lib/auth";
import { formatBranch, formatDateTime, formatNumber } from "@/lib/format";
import type { TransferDetail } from "@/lib/types";
import { QtyDialog, type QtyRow } from "./qty-dialog";
import { RejectDialog } from "./reject-dialog";
import { ORIGIN_LABEL, TransferStatusBadge } from "./transfer-status";

type Dialogs = "approve" | "reject" | "send" | "receive" | "cancel" | null;

const itemLabel = (item: TransferDetail["items"][number]) =>
  `${item.product.sku} — ${item.product.name}`;

export function TransferDetailView() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const query = useTransfer(valid ? id : 0);
  const me = useMe();
  const role = me.data?.role;
  const listHref = role === "PEGAWAI_CABANG" ? "/request-stok" : "/transfer";

  if (!valid) return <ErrorState message="Transfer tidak ditemukan." href={listHref} />;

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
      <ErrorState
        message={getErrorMessage(query.error)}
        href={listHref}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return <Content transfer={query.data} role={role} listHref={listHref} />;
}

function Content({
  transfer: t,
  role,
  listHref,
}: {
  transfer: TransferDetail;
  role: Role;
  listHref: string;
}) {
  const [dialog, setDialog] = useState<Dialogs>(null);
  const approve = useApproveTransfer(t.id);
  const reject = useRejectTransfer(t.id);
  const send = useSendTransfer(t.id);
  const receive = useReceiveTransfer(t.id);
  const cancel = useCancelTransfer(t.id);

  const isAdmin = role === "OWNER" || role === "ADMIN_CABANG";
  const isPegawai = role === "PEGAWAI_CABANG";
  const canApprove = isAdmin && t.status === "DIAJUKAN";
  const canSend = isAdmin && t.status === "DISETUJUI";
  const canReceive = isPegawai && t.status === "DIKIRIM";
  const canCancel = isPegawai && t.status === "DIAJUKAN";

  // Pengiriman langsung tidak punya kolom diminta/disetujui.
  const hasRequested = t.items.some((i) => i.qtyRequested !== null);
  const hasApproved = t.items.some((i) => i.qtyApproved !== null);
  const hasSent = t.items.some((i) => i.qtySent !== null);
  const hasReceived = t.items.some((i) => i.qtyReceived !== null);
  const hasStock = t.items.some((i) => i.warehouseStock !== undefined);
  const totalShortfall = t.items.reduce((sum, i) => sum + (i.shortfall ?? 0), 0);

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      setDialog(null);
      toast.success(success);
    } catch (error) {
      // Dialog tetap terbuka supaya isian tidak hilang; pesan 422 memuat daftar item yang kurang.
      toast.error(getErrorMessage(error), { duration: 10_000 });
    }
  };

  const approveRows: QtyRow[] = t.items.map((i) => ({
    itemId: i.id,
    label: itemLabel(i),
    unit: i.product.unit,
    initial: i.qtyApproved ?? i.qtyRequested ?? 0,
    hint:
      `Diminta ${formatNumber(i.qtyRequested ?? 0)}` +
      (i.warehouseStock !== undefined ? ` · Stok gudang ${formatNumber(i.warehouseStock)}` : ""),
  }));
  const sendRows: QtyRow[] = t.items.map((i) => ({
    itemId: i.id,
    label: itemLabel(i),
    unit: i.product.unit,
    initial: i.qtyApproved ?? 0,
    hint:
      (i.qtyApproved !== null ? `Disetujui ${formatNumber(i.qtyApproved)}` : "") +
      (i.warehouseStock !== undefined ? ` · Stok gudang ${formatNumber(i.warehouseStock)}` : ""),
    warnAbove: i.warehouseStock,
  }));
  const receiveRows: QtyRow[] = t.items.map((i) => ({
    itemId: i.id,
    label: itemLabel(i),
    unit: i.product.unit,
    initial: i.qtySent ?? 0,
    max: i.qtySent ?? 0,
    hint: `Dikirim ${formatNumber(i.qtySent ?? 0)}`,
  }));

  return (
    <div className="max-w-4xl space-y-4">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={listHref} />}
        nativeButton={false}
        className="-ml-2"
      >
        <ArrowLeft />
        {isPegawai ? "Daftar request" : "Daftar pengajuan"}
      </Button>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{t.docNo}</span>
            <TransferStatusBadge status={t.status} />
          </span>
        }
        description={statusHint(t, role)}
        actions={
          <>
            {canApprove && (
              <Button onClick={() => setDialog("approve")}>
                <Check />
                Setujui
              </Button>
            )}
            {canApprove && (
              <Button variant="destructive" onClick={() => setDialog("reject")}>
                <X />
                Tolak
              </Button>
            )}
            {canSend && (
              <Button onClick={() => setDialog("send")}>
                <Send />
                Kirim
              </Button>
            )}
            {canReceive && (
              <Button onClick={() => setDialog("receive")}>
                <PackageCheck />
                Terima Barang
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" onClick={() => setDialog("cancel")}>
                Batalkan Request
              </Button>
            )}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Data dokumen</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Info label="Dari" value={formatBranch(t.fromBranch)} />
            <Info label="Tujuan" value={formatBranch(t.toBranch)} />
            <Info label="Jenis" value={ORIGIN_LABEL[t.origin]} />
            <Info label="Dibuat pada" value={formatDateTime(t.createdAt)} />
            <div className="sm:col-span-2">
              <Info label="Catatan" value={t.note ?? "—"} />
            </div>
            {t.status === "DITOLAK" && (
              <div className="sm:col-span-2">
                <Info label="Alasan penolakan" value={t.rejectReason ?? "—"} />
              </div>
            )}
            {t.status === "DIBATALKAN" && (
              <div className="sm:col-span-2">
                <Info
                  label="Alasan pembatalan"
                  value={t.cancelReason ?? "Dibatalkan oleh pegawai cabang"}
                />
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat proses</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm" aria-label="Riwayat proses">
            {timeline(t).map((step) => (
              <li key={step.label} className="flex gap-3">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${step.tone === "bad" ? "bg-destructive" : "bg-primary"}`}
                  aria-hidden
                />
                <div>
                  <p className="font-medium">{step.label}</p>
                  <p className="text-muted-foreground">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item ({formatNumber(t.itemCount)})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {t.status === "DITERIMA" && totalShortfall > 0 && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Ada selisih {formatNumber(totalShortfall)} unit antara jumlah dikirim dan diterima.
              Selisih tidak mengubah stok; dapat dilihat di Laporan Distribusi.
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produk</TableHead>
                  {hasRequested && <TableHead className="text-right">Diminta</TableHead>}
                  {hasApproved && <TableHead className="text-right">Disetujui</TableHead>}
                  {hasSent && <TableHead className="text-right">Dikirim</TableHead>}
                  {hasReceived && <TableHead className="text-right">Diterima</TableHead>}
                  {hasReceived && <TableHead className="text-right">Selisih</TableHead>}
                  {hasStock && <TableHead className="text-right">Stok gudang</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.items.map((item) => (
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
                    {hasRequested && <Qty value={item.qtyRequested} unit={item.product.unit} />}
                    {hasApproved && <Qty value={item.qtyApproved} unit={item.product.unit} />}
                    {hasSent && <Qty value={item.qtySent} unit={item.product.unit} />}
                    {hasReceived && <Qty value={item.qtyReceived} unit={item.product.unit} />}
                    {hasReceived && (
                      <TableCell
                        className={`text-right ${(item.shortfall ?? 0) > 0 ? "font-medium text-amber-700 dark:text-amber-400" : ""}`}
                      >
                        {item.qtyReceived === null ? "—" : formatNumber(item.shortfall ?? 0)}
                      </TableCell>
                    )}
                    {hasStock && (
                      <TableCell className="text-right">
                        {item.warehouseStock === undefined
                          ? "—"
                          : `${formatNumber(item.warehouseStock)} ${item.product.unit}`}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-medium">
                    Total
                  </TableCell>
                  {hasRequested && <Total value={t.totalRequested} />}
                  {hasApproved && (
                    <Total value={t.items.reduce((s, i) => s + (i.qtyApproved ?? 0), 0)} />
                  )}
                  {hasSent && <Total value={t.totalSent} />}
                  {hasReceived && <Total value={t.totalReceived} />}
                  {hasReceived && <Total value={totalShortfall} />}
                  {hasStock && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <QtyDialog
        open={dialog === "approve"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Setujui request"
        description="Atur jumlah yang disetujui per item (boleh dikurangi atau 0). Stok belum berubah sampai barang dikirim."
        qtyLabel="Disetujui"
        rows={approveRows}
        confirmLabel="Setujui"
        pending={approve.isPending}
        requirePositive
        onSubmit={(values) =>
          void run(
            () =>
              approve.mutateAsync(values.map((v) => ({ itemId: v.itemId, qtyApproved: v.qty }))),
            `Request ${t.docNo} disetujui.`,
          )
        }
      />
      <QtyDialog
        open={dialog === "send"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Kirim barang"
        description="Jumlah kirim terisi dari jumlah yang disetujui dan boleh diubah. Stok gudang utama langsung berkurang; seluruh pengiriman ditolak bila ada item yang stoknya kurang."
        qtyLabel="Dikirim"
        rows={sendRows}
        confirmLabel="Kirim"
        pending={send.isPending}
        requirePositive
        onSubmit={(values) =>
          void run(
            () => send.mutateAsync(values.map((v) => ({ itemId: v.itemId, qtySent: v.qty }))),
            `Transfer ${t.docNo} dikirim dan stok gudang berkurang.`,
          )
        }
      />
      <QtyDialog
        open={dialog === "receive"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Terima barang"
        description="Isi jumlah yang benar-benar diterima (tidak boleh melebihi jumlah dikirim). Stok cabang bertambah sebesar jumlah diterima; selisih hanya dicatat."
        qtyLabel="Diterima"
        rows={receiveRows}
        confirmLabel="Konfirmasi Terima"
        pending={receive.isPending}
        requirePositive={false}
        onSubmit={(values) =>
          void run(
            () =>
              receive.mutateAsync(values.map((v) => ({ itemId: v.itemId, qtyReceived: v.qty }))),
            `Transfer ${t.docNo} diterima dan stok cabang bertambah.`,
          )
        }
      />
      <RejectDialog
        open={dialog === "reject"}
        onOpenChange={(open) => !open && setDialog(null)}
        docNo={t.docNo}
        pending={reject.isPending}
        onSubmit={(reason) =>
          void run(() => reject.mutateAsync(reason), `Request ${t.docNo} ditolak.`)
        }
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Batalkan request?"
        description={
          <p>
            Request <span className="font-mono">{t.docNo}</span> akan dibatalkan dan tidak dapat
            diproses lagi.
          </p>
        }
        confirmLabel="Batalkan Request"
        destructive
        pending={cancel.isPending}
        onConfirm={() => void run(() => cancel.mutateAsync(), `Request ${t.docNo} dibatalkan.`)}
      />
    </div>
  );
}

function statusHint(t: TransferDetail, role: Role): string {
  const admin = role !== "PEGAWAI_CABANG";
  switch (t.status) {
    case "DIAJUKAN":
      return admin
        ? "Menunggu keputusan Anda: setujui (jumlah dapat disesuaikan) atau tolak dengan alasan."
        : "Menunggu persetujuan Owner atau Admin Cabang. Request masih dapat dibatalkan.";
    case "DISETUJUI":
      return admin
        ? "Siap dikirim. Stok gudang dicek dan dikurangi saat Anda menekan Kirim."
        : "Disetujui, menunggu pengiriman dari gudang utama.";
    case "DIKIRIM":
      return admin
        ? "Dalam perjalanan. Menunggu konfirmasi penerimaan dari cabang tujuan."
        : "Barang sedang dikirim. Konfirmasi penerimaan setelah barang tiba.";
    case "DITERIMA":
      return "Selesai. Stok cabang tujuan sudah bertambah sesuai jumlah diterima.";
    case "DITOLAK":
      return "Request ditolak. Stok tidak berubah.";
    case "DIBATALKAN":
      return "Request dibatalkan. Stok tidak berubah.";
  }
}

function timeline(t: TransferDetail) {
  const steps: { label: string; detail: string; tone?: "bad" }[] = [];
  if (t.requestedAt) {
    steps.push({
      label: "Diajukan",
      detail: `${t.requestedBy?.name ?? "—"} · ${formatDateTime(t.requestedAt)}`,
    });
  }
  if (t.status === "DITOLAK") {
    steps.push({
      label: "Ditolak",
      detail: `${t.approvedBy?.name ?? "—"} · ${t.approvedAt ? formatDateTime(t.approvedAt) : "—"}`,
      tone: "bad",
    });
  } else if (t.approvedAt) {
    steps.push({
      label: "Disetujui",
      detail: `${t.approvedBy?.name ?? "—"} · ${formatDateTime(t.approvedAt)}`,
    });
  }
  if (t.status === "DIBATALKAN") {
    steps.push({
      label: "Dibatalkan",
      detail: t.cancelReason ?? "Oleh pegawai cabang",
      tone: "bad",
    });
  }
  if (t.sentAt) {
    steps.push({
      label: t.origin === "DIRECT" ? "Dikirim langsung" : "Dikirim",
      detail: `${t.sentBy?.name ?? "—"} · ${formatDateTime(t.sentAt)}`,
    });
  }
  if (t.receivedAt) {
    steps.push({
      label: "Diterima",
      detail: `${t.receivedBy?.name ?? "—"} · ${formatDateTime(t.receivedAt)}`,
    });
  }
  if (steps.length === 0) {
    steps.push({ label: "Dibuat", detail: formatDateTime(t.createdAt) });
  }
  return steps;
}

function Qty({ value, unit }: { value: number | null; unit: string }) {
  return (
    <TableCell className="text-right">
      {value === null ? "—" : `${formatNumber(value)} ${unit}`}
    </TableCell>
  );
}

function Total({ value }: { value: number | null }) {
  return (
    <TableCell className="text-right font-semibold">
      {value === null ? "—" : formatNumber(value)}
    </TableCell>
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

function ErrorState({
  message,
  href,
  onRetry,
}: {
  message: string;
  href: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border py-12 text-center">
      <p className="text-sm">{message}</p>
      <div className="flex gap-2">
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Coba lagi
          </Button>
        )}
        <Button variant="outline" render={<Link href={href} />} nativeButton={false}>
          Kembali ke daftar
        </Button>
      </div>
    </div>
  );
}
