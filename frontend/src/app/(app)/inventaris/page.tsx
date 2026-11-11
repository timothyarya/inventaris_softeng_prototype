import type { Metadata } from "next";
import { StockList } from "@/components/stocks/stock-list";

export const metadata: Metadata = { title: "Inventaris" };

export default function InventarisPage() {
  return <StockList mode="pegawai" />;
}
