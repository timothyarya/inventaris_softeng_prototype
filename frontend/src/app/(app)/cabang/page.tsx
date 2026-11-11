import type { Metadata } from "next";
import { BranchList } from "@/components/branches/branch-list";

export const metadata: Metadata = { title: "Cabang" };

export default function CabangPage() {
  return <BranchList />;
}
