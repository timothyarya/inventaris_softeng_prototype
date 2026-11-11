import type { Metadata } from "next";
import { StockInList } from "@/components/stock-ins/stock-in-list";

export const metadata: Metadata = { title: "Stok Masuk" };

export default function StokMasukPage() {
  return <StockInList />;
}
