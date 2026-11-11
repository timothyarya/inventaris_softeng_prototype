import type { Metadata } from "next";
import { UserList } from "@/components/users/user-list";

export const metadata: Metadata = { title: "User" };

export default function UsersPage() {
  return <UserList />;
}
