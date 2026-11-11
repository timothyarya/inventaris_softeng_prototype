"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ME_QUERY_KEY, type Role } from "@/lib/auth";
import { toQueryString } from "@/lib/query";
import type { ManagedUser, Paginated } from "@/lib/types";

export type UserListParams = {
  page: number;
  pageSize: number;
  q?: string;
  role?: Role;
  /** Id cabang, atau "none" untuk yang belum punya cabang. */
  branchId?: number | "none";
  status?: "active" | "inactive";
};

export type UserCreateInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
  branchId: number | null;
};

export type UserUpdateInput = {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  branchId?: number | null;
};

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: ["users", "list", params],
    queryFn: () => api<Paginated<ManagedUser>>(`/users${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: number) {
  return useQuery({
    queryKey: ["users", "detail", id],
    queryFn: async () => (await api<{ data: ManagedUser }>(`/users/${id}`)).data,
    enabled: id > 0,
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["users"] }),
      // Jumlah pegawai per cabang berubah; Owner yang mengubah dirinya sendiri juga memengaruhi sesi.
      queryClient.invalidateQueries({ queryKey: ["branches"] }),
      queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
    ]);
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (input: UserCreateInput) =>
      (await api<{ data: ManagedUser }>("/users", { method: "POST", body: input })).data,
    onSuccess: invalidate,
  });
}

export function useUpdateUser(id: number) {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (input: UserUpdateInput) =>
      (await api<{ data: ManagedUser }>(`/users/${id}`, { method: "PATCH", body: input })).data,
    onSuccess: invalidate,
  });
}

export function useSetUserActive(id: number) {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (active: boolean) =>
      (
        await api<{ data: ManagedUser }>(`/users/${id}/${active ? "activate" : "deactivate"}`, {
          method: "PATCH",
        })
      ).data,
    onSuccess: invalidate,
  });
}
