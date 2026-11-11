"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { toQueryString } from "@/lib/query";
import type { Paginated, StockRow } from "@/lib/types";

export type StockListParams = {
  page: number;
  pageSize: number;
  /** Diabaikan backend untuk Pegawai Cabang (selalu cabangnya sendiri). */
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

/**
 * Stok seluruh produk di satu cabang sebagai peta productId -> qty (semua halaman).
 * Dipakai form pengiriman langsung untuk menampilkan stok gudang di samping tiap produk.
 */
export function useBranchStockMap(branchId: number | undefined) {
  return useQuery({
    queryKey: ["stocks", "map", branchId],
    enabled: branchId !== undefined && branchId > 0,
    queryFn: async () => {
      const map: Record<number, number> = {};
      for (let page = 1; ; page++) {
        const res = await api<Paginated<StockRow>>(
          `/stocks${toQueryString({ page, pageSize: 100, branchId })}`,
        );
        for (const row of res.data) map[row.product.id] = row.qty;
        if (page * res.meta.pageSize >= res.meta.total || res.data.length === 0) return map;
      }
    },
  });
}
