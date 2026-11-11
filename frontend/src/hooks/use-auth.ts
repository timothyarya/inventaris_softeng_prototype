"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { ME_QUERY_KEY, type AuthUser } from "@/lib/auth";

/** User yang sedang login. 401 berarti belum login / sesi berakhir / akun dinonaktifkan. */
export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => (await api<{ data: AuthUser }>("/auth/me")).data,
    retry: false,
    staleTime: 30_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) =>
      (await api<{ data: AuthUser }>("/auth/login", { method: "POST", body: input })).data,
    onSuccess: (user) => {
      queryClient.setQueryData(ME_QUERY_KEY, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSettled: () => {
      // Hapus seluruh cache agar data user sebelumnya tidak terlihat oleh user berikutnya.
      queryClient.clear();
    },
  });
}
