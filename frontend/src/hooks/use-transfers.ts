"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { toQueryString } from "@/lib/query";
import type { Paginated, TransferDetail, TransferSummary } from "@/lib/types";

export type TransferListParams = {
  page: number;
  pageSize: number;
  q?: string;
  /** Daftar status dipisah koma, mis. "DIAJUKAN,DISETUJUI". */
  status?: string;
  /** Cabang tujuan (diabaikan backend untuk Pegawai). */
  branchId?: number;
  origin?: "request" | "direct";
  /** YYYY-MM-DD */
  from?: string;
  to?: string;
};

export type RequestInput = {
  note: string | null;
  items: { productId: number; qty: number }[];
};

export type DirectInput = RequestInput & { toBranchId: number };

export function useTransfers(params: TransferListParams) {
  return useQuery({
    queryKey: ["transfers", "list", params],
    queryFn: () => api<Paginated<TransferSummary>>(`/transfers${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useTransfer(id: number) {
  return useQuery({
    queryKey: ["transfers", "detail", id],
    queryFn: async () => (await api<{ data: TransferDetail }>(`/transfers/${id}`)).data,
    enabled: id > 0,
  });
}

/** Transfer mengubah stok gudang/cabang dan ringkasan cabang, jadi semuanya dimuat ulang. */
function useInvalidateTransfers() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["transfers"] }),
      queryClient.invalidateQueries({ queryKey: ["stocks"] }),
      queryClient.invalidateQueries({ queryKey: ["branches"] }),
    ]);
}

async function post(path: string, body?: unknown) {
  return (await api<{ data: TransferDetail }>(path, { method: "POST", body: body ?? {} })).data;
}

export function useCreateRequest() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (input: RequestInput) => post("/transfers/requests", input),
    onSuccess: invalidate,
  });
}

export function useCreateDirect() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (input: DirectInput) => post("/transfers/direct", input),
    onSuccess: invalidate,
  });
}

export function useCancelTransfer(id: number) {
  const invalidate = useInvalidateTransfers();
  return useMutation({ mutationFn: () => post(`/transfers/${id}/cancel`), onSuccess: invalidate });
}

export function useRejectTransfer(id: number) {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (reason: string) => post(`/transfers/${id}/reject`, { reason }),
    onSuccess: invalidate,
  });
}

export function useApproveTransfer(id: number) {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (items: { itemId: number; qtyApproved: number }[]) =>
      post(`/transfers/${id}/approve`, { items }),
    onSuccess: invalidate,
  });
}

export function useSendTransfer(id: number) {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (items: { itemId: number; qtySent: number }[]) =>
      post(`/transfers/${id}/send`, { items }),
    // Gagal 422 (stok kurang) tidak mengubah apa pun, tetapi stok gudang mungkin sudah berubah.
    onSettled: invalidate,
  });
}

export function useReceiveTransfer(id: number) {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (items: { itemId: number; qtyReceived: number }[]) =>
      post(`/transfers/${id}/receive`, { items }),
    onSuccess: invalidate,
  });
}
