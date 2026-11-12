"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useBranches } from "@/hooks/use-branches";
import type { ReportParams } from "@/hooks/use-reports";
import { firstOfMonthJakarta, formatBranch, todayJakarta } from "@/lib/format";

/**
 * Filter umum laporan (bagian 4.8): cabang (kosong = seluruh cabang) dan periode. Periode wajib
 * terisi; bawaannya tanggal 1 bulan berjalan sampai hari ini (WIB). Query baru dijalankan saat
 * filter valid (`valid`).
 */
export function useReportFilters() {
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState(firstOfMonthJakarta);
  const [to, setTo] = useState(todayJakarta);

  const missing = from === "" || to === "";
  const reversed = !missing && from > to;
  const error = missing
    ? "Tanggal mulai dan tanggal akhir wajib diisi."
    : reversed
      ? "Tanggal mulai tidak boleh setelah tanggal akhir."
      : null;
  const params: ReportParams = { branchId: branchId ? Number(branchId) : undefined, from, to };

  return { branchId, setBranchId, from, setFrom, to, setTo, error, valid: error === null, params };
}

export type ReportFilterState = ReturnType<typeof useReportFilters>;

export function ReportFilters({ filters }: { filters: ReportFilterState }) {
  // Cabang nonaktif tetap dapat dipilih karena riwayatnya tetap ada di laporan.
  const branches = useBranches({ page: 1, pageSize: 100 });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <NativeSelect
          aria-label="Filter cabang"
          value={filters.branchId}
          onChange={(e) => filters.setBranchId(e.target.value)}
        >
          <NativeSelectOption value="">Seluruh cabang</NativeSelectOption>
          {branches.data?.data.map((b) => (
            <NativeSelectOption key={b.id} value={String(b.id)}>
              {formatBranch(b)}
              {b.isActive ? "" : " (nonaktif)"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          Dari
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => filters.setFrom(e.target.value)}
            aria-label="Tanggal mulai"
            className="w-40"
          />
        </label>
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          Sampai
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => filters.setTo(e.target.value)}
            aria-label="Tanggal akhir"
            className="w-40"
          />
        </label>
      </div>
      {filters.error && <p className="text-destructive text-sm">{filters.error}</p>}
    </div>
  );
}
