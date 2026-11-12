import type { Metadata } from "next";
import { MovementList } from "@/components/movements/movement-list";

export const metadata: Metadata = { title: "Riwayat Stok" };

export default function RiwayatPage() {
  return <MovementList />;
}
