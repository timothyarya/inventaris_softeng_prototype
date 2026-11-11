"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { toQueryString } from "@/lib/query";
import type { Paginated, StockRow } from "@/lib/types";

export type StockListParams = {
  page: number;
  pageSize: number;
  /** Diabaikan backend untuk Pegawai (selalu cabangnya sendiri). */
  branchId?: number;
  productId?: number;
  q?: string;
  lowOnly?: boolean;
};

export function useStocks(params: StockListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["stocks", "list", params],
    queryFn: () => api<Paginated<StockRow>>(`/stocks${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}
