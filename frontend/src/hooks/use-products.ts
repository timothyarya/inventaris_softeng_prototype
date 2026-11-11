"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { toQueryString } from "@/lib/query";
import type { Paginated, Product } from "@/lib/types";

export type ProductListParams = {
  page: number;
  pageSize: number;
  q?: string;
  categoryId?: number;
  status?: "active" | "inactive";
};

export type ProductInput = {
  sku: string;
  name: string;
  unit: string;
  minStock: number;
  categoryId: number | null;
};

export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: ["products", "list", params],
    queryFn: () => api<Paginated<Product>>(`/products${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: ["products", "detail", id],
    queryFn: async () => (await api<{ data: Product }>(`/products/${id}`)).data,
    enabled: id > 0,
  });
}

function useInvalidateProducts() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
    ]);
}

export function useCreateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (input: ProductInput) =>
      (await api<{ data: Product }>("/products", { method: "POST", body: input })).data,
    onSuccess: invalidate,
  });
}

export function useUpdateProduct(id: number) {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (input: Partial<ProductInput>) =>
      (await api<{ data: Product }>(`/products/${id}`, { method: "PATCH", body: input })).data,
    onSuccess: invalidate,
  });
}

export function useSetProductActive(id: number) {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (active: boolean) =>
      (
        await api<{ data: Product }>(`/products/${id}/${active ? "activate" : "deactivate"}`, {
          method: "PATCH",
        })
      ).data,
    onSuccess: invalidate,
  });
}

export function useDeleteProduct(id: number) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: () => api(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      // Buang cache detail agar tidak dimuat ulang (404) sebelum halaman berpindah.
      queryClient.removeQueries({ queryKey: ["products", "detail", id] });
      return invalidate();
    },
  });
}
