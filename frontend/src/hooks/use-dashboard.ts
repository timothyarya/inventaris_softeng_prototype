"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { toQueryString } from "@/lib/query";
import type { Dashboard } from "@/lib/types";

/** `branchId` hanya berlaku untuk Owner/Admin Gudang; Pegawai Cabang diabaikan backend. */
export function useDashboard(params: { branchId?: number } = {}) {
  return useQuery({
    queryKey: ["dashboard", params],
    queryFn: async () =>
      (await api<{ data: Dashboard }>(`/dashboard${toQueryString(params)}`)).data,
    placeholderData: keepPreviousData,
    // Angka harus segar setiap dashboard dibuka (stok berubah dari banyak halaman lain).
    staleTime: 0,
  });
}
