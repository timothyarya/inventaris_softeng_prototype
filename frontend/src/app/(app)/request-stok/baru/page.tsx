import type { Metadata } from "next";
import { TransferCreate } from "@/components/transfers/transfer-create";

export const metadata: Metadata = { title: "Buat Request Stok" };

export default function RequestStokBaruPage() {
  return <TransferCreate mode="request" />;
}
