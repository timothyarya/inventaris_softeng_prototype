import type { Metadata } from "next";
import { TransferList } from "@/components/transfers/transfer-list";

export const metadata: Metadata = { title: "Semua Pengajuan" };

export default function TransferPage() {
  return <TransferList />;
}
