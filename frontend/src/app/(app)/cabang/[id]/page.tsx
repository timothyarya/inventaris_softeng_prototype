import type { Metadata } from "next";
import { BranchDetail } from "@/components/branches/branch-detail";

export const metadata: Metadata = { title: "Detail Cabang" };

export default function CabangDetailPage() {
  return <BranchDetail />;
}
