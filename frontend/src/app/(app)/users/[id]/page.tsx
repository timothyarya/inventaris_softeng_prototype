import type { Metadata } from "next";
import { UserDetail } from "@/components/users/user-detail";

export const metadata: Metadata = { title: "Detail User" };

export default function UsersDetailPage() {
  return <UserDetail />;
}
