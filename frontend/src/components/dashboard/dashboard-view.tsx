"use client";

import {
  AlertTriangle,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  PackageX,
  Send,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getErrorMessage } from "@/lib/apiClient";
import { PageHeader } from "@/components/data/page-header";
import { OpnameStatusBadge } from "@/components/opnames/opname-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useMe } from "@/hooks/use-auth";
import { useActiveBranches } from "@/hooks/use-branches";
import { useDashboard } from "@/hooks/use-dashboard";
import { ROLE_LABEL } from "@/lib/auth";
import { formatBranch, formatDate } from "@/lib/format";
import type { DashboardAdmin, DashboardPegawai } from "@/lib/types";
import { DistributionChart } from "./distribution-chart";
import { LowStockTable } from "./low-stock-table";
import { RecentMovements } from "./recent-movements";
import { StatCard, StatCardSkeleton } from "./stat-card";

function AdminCards({ cards, filtered }: { cards: DashboardAdmin["cards"]; filtered: boolean }) {
  const scope = filtered ? "di cabang ini" : "di semua cabang";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="dashboard-cards">
      <StatCard
        testId="card-activeProducts"
        label="Total produk aktif"
        value={cards.activeProducts}
        icon={Boxes}
      />
      <StatCard
        testId="card-activeBranches"
        label="Total cabang aktif"
        value={cards.activeBranches}
        icon={Building2}
      />
      <StatCard
        testId="card-lowStock"
        label="Stok menipis"
        hint={`Item ${scope}`}
        value={cards.lowStock}
        icon={AlertTriangle}
        tone="warning"
      />
      <StatCard
        testId="card-outOfStock"
        label="Stok habis"
        hint={`Item ${scope}`}
        value={cards.outOfStock}
        icon={PackageX}
        tone="danger"
      />
      <StatCard
        testId="card-pendingRequests"
        label="Request menunggu"
        hint="Menunggu persetujuan"
        value={cards.pendingRequests}
        icon={ClipboardList}
      />
      <StatCard
        testId="card-readyToSend"
        label="Transfer siap kirim"
        hint="Sudah disetujui"
        value={cards.readyToSend}
        icon={Send}
      />
      <StatCard
        testId="card-pendingOpnames"
        label="Opname menunggu"
        hint="Menunggu verifikasi"
        value={cards.pendingOpnames}
        icon={ClipboardCheck}
      />
    </div>
  );
}

function PegawaiCards({ cards }: { cards: DashboardPegawai["cards"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="dashboard-cards">
      <StatCard
        testId="card-activeProducts"
        label="Jumlah produk"
        hint="Produk aktif"
        value={cards.activeProducts}
        icon={Boxes}
      />
      <StatCard
        testId="card-lowStock"
        label="Stok menipis"
        hint="Item di cabang Anda"
        value={cards.lowStock}
        icon={AlertTriangle}
        tone="warning"
      />
      <StatCard
        testId="card-outOfStock"
        label="Stok habis"
        hint="Item di cabang Anda"
        value={cards.outOfStock}
        icon={PackageX}
        tone="danger"
      />
      <StatCard
        testId="card-ongoingRequests"
        label="Request saya berjalan"
        hint="Diajukan, disetujui, atau dikirim"
        value={cards.ongoingRequests}
        icon={ClipboardList}
      />
      <StatCard
        testId="card-incomingToConfirm"
        label="Kiriman perlu dikonfirmasi"
        hint="Sudah dikirim, belum diterima"
        value={cards.incomingToConfirm}
        icon={Truck}
      />
    </div>
  );
}

function LastOpnameCard({ opname }: { opname: DashboardPegawai["lastOpname"] }) {
  return (
    <Card data-testid="dashboard-last-opname">
      <CardHeader>
        <CardTitle>Opname terakhir</CardTitle>
        <CardDescription>Status stok opname terbaru di cabang Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        {opname ? (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/opname/${opname.id}`} className="font-mono font-medium hover:underline">
                {opname.docNo}
              </Link>
              <OpnameStatusBadge status={opname.status} />
            </div>
            <p className="text-muted-foreground">Tanggal hitung {formatDate(opname.date)}</p>
            {opname.status === "DITOLAK" && opname.verifyNote && (
              <p>Alasan penolakan: {opname.verifyNote}</p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Belum ada stok opname di cabang Anda.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CardsSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Isi halaman /dashboard (bagian 4.9): berbeda untuk Owner/Admin Gudang dan Pegawai Cabang. */
export function DashboardView() {
  const { data: user } = useMe();
  const isAdmin = user?.role !== "PEGAWAI_CABANG";
  const [branchId, setBranchId] = useState("");
  const branches = useActiveBranches({ enabled: isAdmin && !!user });
  const dashboard = useDashboard(isAdmin && branchId ? { branchId: Number(branchId) } : {});

  if (!user) return null;

  const data = dashboard.data;
  const welcome = `Selamat datang, ${user.name} · ${ROLE_LABEL[user.role]}${
    user.branch ? ` · ${formatBranch(user.branch)}` : " · Semua cabang"
  }`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description={welcome}
        actions={
          isAdmin && (
            <NativeSelect
              aria-label="Filter cabang"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <NativeSelectOption value="">Semua cabang</NativeSelectOption>
              {branches.data?.data.map((b) => (
                <NativeSelectOption key={b.id} value={String(b.id)}>
                  {formatBranch(b)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )
        }
      />

      {dashboard.error && !data && (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-12 text-center">
          <p className="text-sm">{getErrorMessage(dashboard.error)}</p>
          <Button variant="outline" onClick={() => dashboard.refetch()}>
            Coba lagi
          </Button>
        </div>
      )}

      {!data && !dashboard.error && <CardsSkeleton count={isAdmin ? 7 : 5} />}

      {data?.scope === "ADMIN" && (
        <>
          {data.branch && (
            <p className="text-muted-foreground text-sm" data-testid="dashboard-filter-note">
              Menampilkan {formatBranch(data.branch)}. Total produk aktif dan total cabang aktif
              tidak terpengaruh filter.
            </p>
          )}
          <AdminCards cards={data.cards} filtered={!!data.branch} />
          <div className="grid gap-4 2xl:grid-cols-2">
            <LowStockTable
              items={data.lowStockItems}
              total={data.cards.lowStock + data.cards.outOfStock}
              showBranch
              moreHref="/stok"
            />
            <DistributionChart distribution={data.distribution} />
          </div>
          <RecentMovements movements={data.recentMovements} isAdmin />
        </>
      )}

      {data?.scope === "PEGAWAI" && (
        <>
          <PegawaiCards cards={data.cards} />
          <div className="grid gap-4 2xl:grid-cols-2">
            <LowStockTable
              items={data.lowStockItems}
              total={data.cards.lowStock + data.cards.outOfStock}
              showBranch={false}
              moreHref="/inventaris"
            />
            <LastOpnameCard opname={data.lastOpname} />
          </div>
          <RecentMovements movements={data.recentMovements} isAdmin={false} />
        </>
      )}
    </div>
  );
}
