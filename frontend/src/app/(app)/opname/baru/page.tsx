import type { Metadata } from "next";
import { OpnameCreate } from "@/components/opnames/opname-create";

export const metadata: Metadata = { title: "Opname Baru" };

export default function OpnameBaruPage() {
  return <OpnameCreate />;
}
