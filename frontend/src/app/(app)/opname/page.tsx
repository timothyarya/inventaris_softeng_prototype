import type { Metadata } from "next";
import { OpnameList } from "@/components/opnames/opname-list";

export const metadata: Metadata = { title: "Stok Opname" };

export default function OpnamePage() {
  return <OpnameList />;
}
