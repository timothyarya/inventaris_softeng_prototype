import type { Metadata } from "next";
import { StockReportView } from "@/components/reports/stock-report";

export const metadata: Metadata = { title: "Laporan Stok" };

export default function LaporanStokPage() {
  return <StockReportView />;
}
