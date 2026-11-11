import type { Metadata } from "next";
import { OpnameDetailView } from "@/components/opnames/opname-detail";

export const metadata: Metadata = { title: "Detail Opname" };

export default function OpnameDetailPage() {
  return <OpnameDetailView />;
}
