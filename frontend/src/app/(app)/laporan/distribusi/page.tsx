import type { Metadata } from "next";
import { DistributionReportView } from "@/components/reports/distribution-report";

export const metadata: Metadata = { title: "Laporan Distribusi" };

export default function LaporanDistribusiPage() {
  return <DistributionReportView />;
}
