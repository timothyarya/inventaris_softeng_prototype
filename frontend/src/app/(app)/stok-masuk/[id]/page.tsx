import type { Metadata } from "next";
import { StockInDetail } from "@/components/stock-ins/stock-in-detail";

export const metadata: Metadata = { title: "Detail Stok Masuk" };

export default function StokMasukDetailPage() {
  return <StockInDetail />;
}
