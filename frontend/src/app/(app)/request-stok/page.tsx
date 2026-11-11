import type { Metadata } from "next";
import { RequestStokList } from "@/components/transfers/request-stok-list";

export const metadata: Metadata = { title: "Request Stok" };

export default function RequestStokPage() {
  return <RequestStokList />;
}
