import type { Metadata } from "next";
import { StockInCreate } from "@/components/stock-ins/stock-in-create";

export const metadata: Metadata = { title: "Tambah Stok Masuk" };

export default function StokMasukBaruPage() {
  return <StockInCreate />;
}
