"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { toQueryString } from "@/lib/query";
import type { Branch, BranchDetail, DeactivatedBranch, Paginated } from "@/lib/types";

export type BranchListParams = { page: number; pageSize: number; q?: string; active?: boolean };

export type BranchInput = {
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
};
export type BranchUpdateInput = { name: string; address: string | null; phone: string | null };

export function useBranches(params: BranchListParams) {
  return useQuery({
    queryKey: ["branches", "list", params],
    queryFn: () => api<Paginated<Branch>>(`/branches${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

/** Pilihan cabang aktif (untuk assign user, filter, dan dropdown lain). */
export function useActiveBranches() {
  return useBranches({ page: 1, pageSize: 100, active: true });
}

export function useBranch(id: number) {
  return useQuery({
    queryKey: ["branches", "detail", id],
    queryFn: async () => (await api<{ data: BranchDetail }>(`/branches/${id}`)).data,
    enabled: id > 0,
  });
}

function useInvalidateBranches() {
  const queryClient = useQueryClient();
  // Penugasan pegawai ikut berubah saat cabang dinonaktifkan, jadi data user juga dimuat ulang.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["branches"] }),
      queryClient.invalidateQueries({ queryKey: ["users"] }),
    ]);
}

export function useCreateBranch() {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: async (input: BranchInput) =>
      (await api<{ data: Branch }>("/branches", { method: "POST", body: input })).data,
    onSuccess: invalidate,
  });
}

export function useUpdateBranch(id: number) {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: async (input: BranchUpdateInput) =>
      (await api<{ data: Branch }>(`/branches/${id}`, { method: "PATCH", body: input })).data,
    onSuccess: invalidate,
  });
}

export function useDeactivateBranch(id: number) {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: async () =>
      (await api<{ data: DeactivatedBranch }>(`/branches/${id}/deactivate`, { method: "PATCH" }))
        .data,
    onSuccess: invalidate,
  });
}

export function useActivateBranch(id: number) {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: async () =>
      (await api<{ data: Branch }>(`/branches/${id}/activate`, { method: "PATCH" })).data,
    onSuccess: invalidate,
  });
}
