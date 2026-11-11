import type { Metadata } from "next";
import { BranchCreateForm } from "@/components/branches/branch-create-form";

export const metadata: Metadata = { title: "Tambah Cabang" };

export default function CabangBaruPage() {
  return <BranchCreateForm />;
}
