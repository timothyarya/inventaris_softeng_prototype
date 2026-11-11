import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FullPageLoading } from "@/components/layout/full-page-message";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Suspense dibutuhkan karena route dinamis (mis. [...slug]) membaca pathname di client.
  return (
    <Suspense fallback={<FullPageLoading />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
