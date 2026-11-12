"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { toQueryString } from "@/lib/query";
import type { DistributionReport, StockReport } from "@/lib/types";

export type ReportParams = { branchId?: number; from: string; to: string };

/** `enabled` dimatikan selama filter belum valid (mis. tanggal mulai setelah tanggal akhir). */
export function useStockReport(params: ReportParams, enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "stock", params],
    queryFn: async () =>
      (await api<{ data: StockReport }>(`/reports/stock${toQueryString(params)}`)).data,
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 0,
  });
}

export function useDistributionReport(params: ReportParams, enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "distribution", params],
    queryFn: async () =>
      (await api<{ data: DistributionReport }>(`/reports/distribution${toQueryString(params)}`))
        .data,
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 0,
  });
}
