"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/apiClient";
import { ME_QUERY_KEY } from "@/lib/auth";

function makeQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
    queryCache: new QueryCache({
      // Sesi berakhir atau akun dinonaktifkan di tengah pemakaian: segarkan /auth/me,
      // sehingga AuthGuard mengarahkan user ke /login.
      onError: (error, query) => {
        if (error instanceof ApiError && error.status === 401) {
          const isMe =
            query.queryKey[0] === ME_QUERY_KEY[0] && query.queryKey[1] === ME_QUERY_KEY[1];
          if (!isMe) void client.invalidateQueries({ queryKey: ME_QUERY_KEY });
        }
      },
    }),
  });
  return client;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
