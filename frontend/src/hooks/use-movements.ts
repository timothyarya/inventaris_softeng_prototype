"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { toQueryString } from "@/lib/query";
import type { Movement, Paginated } from "@/lib/types";

export type MovementListParams = {
  page: number;
  pageSize: number;
  /** Diabaikan backend untuk Pegawai Cabang (selalu cabangnya sendiri). */
  branchId?: number;
  productId?: number;
  /** Daftar tipe dipisah koma, mis. "MASUK,OPNAME". */
  type?: string;
  /** YYYY-MM-DD (hari Asia/Jakarta, inklusif) */
  from?: string;
  to?: string;
};

export function useMovements(params: MovementListParams) {
  return useQuery({
    queryKey: ["movements", "list", params],
    queryFn: () => api<Paginated<Movement>>(`/movements${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}
