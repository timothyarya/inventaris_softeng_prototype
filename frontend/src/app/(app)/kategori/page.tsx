import type { Metadata } from "next";
import { CategoryList } from "@/components/categories/category-list";

export const metadata: Metadata = { title: "Kategori" };

export default function KategoriPage() {
  return <CategoryList />;
}
