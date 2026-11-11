import type { Metadata } from "next";
import { TransferDetailView } from "@/components/transfers/transfer-detail";

export const metadata: Metadata = { title: "Detail Transfer" };

export default function TransferDetailPage() {
  return <TransferDetailView />;
}
