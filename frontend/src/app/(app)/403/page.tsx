import type { Metadata } from "next";
import { Forbidden } from "@/components/layout/forbidden";

export const metadata: Metadata = { title: "403 — Akses ditolak" };

export default function ForbiddenPage() {
  return <Forbidden />;
}
