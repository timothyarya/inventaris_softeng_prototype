import type { Metadata } from "next";
import { UserCreate } from "@/components/users/user-create";

export const metadata: Metadata = { title: "Tambah User" };

export default function UsersBaruPage() {
  return <UserCreate />;
}
