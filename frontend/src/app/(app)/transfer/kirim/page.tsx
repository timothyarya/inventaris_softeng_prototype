import type { Metadata } from "next";
import { TransferCreate } from "@/components/transfers/transfer-create";

export const metadata: Metadata = { title: "Form Pengiriman" };

export default function TransferKirimPage() {
  return <TransferCreate mode="direct" />;
}
