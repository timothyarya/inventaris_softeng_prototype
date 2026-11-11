import type { Metadata } from "next";
import { DashboardPlaceholder } from "./dashboard-placeholder";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardPlaceholder />;
}
