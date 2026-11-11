import type { Metadata } from "next";
import { AwaitingAssignment } from "@/components/auth/awaiting-assignment";

export const metadata: Metadata = { title: "Menunggu penugasan cabang" };

export default function AwaitingAssignmentPage() {
  return <AwaitingAssignment />;
}
