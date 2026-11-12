"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { toQueryString } from "@/lib/query";
import type { OpnameDetail, OpnamePrefill, OpnameSummary, Paginated } from "@/lib/types";

export type OpnameListParams = {
  page: number;
  pageSize: number;
  q?: string;
  /** Daftar status dipisah koma, mis. "MENUNGGU,DITOLAK". */
  status?: string;
  /** Diabaikan backend untuk Pegawai Cabang. */
  branchId?: number;
  /** YYYY-MM-DD (tanggal opname) */
  from?: string;
  to?: string;
};

export type OpnameInput = {
  /** Wajib untuk Owner/Admin Gudang; Pegawai Cabang selalu cabangnya sendiri. */
  branchId?: number;
  date: string;
  note: string | null;
  items: { productId: number; qtyPhysical: number; remark: string | null }[];
};

export function useOpnames(params: OpnameListParams) {
  return useQuery({
    queryKey: ["opnames", "list", params],
    queryFn: () => api<Paginated<OpnameSummary>>(`/opnames${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useOpname(id: number) {
  return useQuery({
    queryKey: ["opnames", "detail", id],
    queryFn: async () => (await api<{ data: OpnameDetail }>(`/opnames/${id}`)).data,
    enabled: id > 0,
  });
}

/**
 * Produk aktif + qty sistem untuk formulir hitung fisik. `branchId` kosong = cabang sendiri
 * (Pegawai Cabang). Selalu diambil ulang agar qty sistem dan opname yang menunggu terkini.
 */
export function useOpnamePrefill(branchId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ["opnames", "prefill", branchId ?? "own"],
    queryFn: async () =>
      (await api<{ data: OpnamePrefill }>(`/opnames/prefill${toQueryString({ branchId })}`)).data,
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

/** Opname yang disetujui mengubah stok dan ringkasan cabang, jadi semuanya dimuat ulang. */
function useInvalidateOpnames() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["opnames"] }),
      queryClient.invalidateQueries({ queryKey: ["stocks"] }),
      queryClient.invalidateQueries({ queryKey: ["movements"] }),
      queryClient.invalidateQueries({ queryKey: ["branches"] }),
    ]);
}

export function useCreateOpname() {
  const invalidate = useInvalidateOpnames();
  return useMutation({
    mutationFn: async (input: OpnameInput) =>
      (await api<{ data: OpnameDetail }>("/opnames", { method: "POST", body: input })).data,
    onSuccess: invalidate,
  });
}

export function useApproveOpname(id: number) {
  const invalidate = useInvalidateOpnames();
  return useMutation({
    mutationFn: async () =>
      (await api<{ data: OpnameDetail }>(`/opnames/${id}/approve`, { method: "POST", body: {} }))
        .data,
    // Gagal 422 (stok kurang) tidak mengubah apa pun, tetapi stok mungkin sudah berubah.
    onSettled: invalidate,
  });
}

export function useRejectOpname(id: number) {
  const invalidate = useInvalidateOpnames();
  return useMutation({
    mutationFn: async (verifyNote: string) =>
      (
        await api<{ data: OpnameDetail }>(`/opnames/${id}/reject`, {
          method: "POST",
          body: { verifyNote },
        })
      ).data,
    onSettled: invalidate,
  });
}
