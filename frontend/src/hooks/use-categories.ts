"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { toQueryString } from "@/lib/query";
import type { Category, Paginated } from "@/lib/types";

export type CategoryListParams = { page: number; pageSize: number; q?: string };

export function useCategories(params: CategoryListParams) {
  return useQuery({
    queryKey: ["categories", "list", params],
    queryFn: () => api<Paginated<Category>>(`/categories${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

/** Semua kategori untuk dropdown (maksimal 100 sesuai batas pageSize). */
export function useAllCategories() {
  return useCategories({ page: 1, pageSize: 100 });
}

function useInvalidateCategories() {
  const queryClient = useQueryClient();
  // Produk menampilkan nama kategorinya, jadi ikut dimuat ulang.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
    ]);
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: async (input: { name: string }) =>
      (await api<{ data: Category }>("/categories", { method: "POST", body: input })).data,
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) =>
      (await api<{ data: Category }>(`/categories/${id}`, { method: "PATCH", body: { name } }))
        .data,
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (id: number) => api(`/categories/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
