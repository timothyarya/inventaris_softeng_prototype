"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { toQueryString } from "@/lib/query";
import type { Paginated, StockInDetail, StockInSummary } from "@/lib/types";

export type StockInListParams = {
  page: number;
  pageSize: number;
  q?: string;
  /** YYYY-MM-DD */
  from?: string;
  to?: string;
};

export type StockInInput = {
  date: string;
  supplierName: string;
  invoiceNo: string | null;
  note: string | null;
  items: { productId: number; qty: number }[];
};

export function useStockIns(params: StockInListParams) {
  return useQuery({
    queryKey: ["stock-ins", "list", params],
    queryFn: () => api<Paginated<StockInSummary>>(`/stock-ins${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useStockIn(id: number) {
  return useQuery({
    queryKey: ["stock-ins", "detail", id],
    queryFn: async () => (await api<{ data: StockInDetail }>(`/stock-ins/${id}`)).data,
    enabled: id > 0,
  });
}

export function useCreateStockIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StockInInput) =>
      (await api<{ data: StockInDetail }>("/stock-ins", { method: "POST", body: input })).data,
    // Stok gudang berubah, begitu pula ringkasan stok cabang.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stock-ins"] }),
        queryClient.invalidateQueries({ queryKey: ["stocks"] }),
        queryClient.invalidateQueries({ queryKey: ["branches"] }),
      ]),
  });
}
