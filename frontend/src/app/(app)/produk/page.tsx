import type { Metadata } from "next";
import { ProductList } from "@/components/products/product-list";

export const metadata: Metadata = { title: "Produk" };

export default function ProdukPage() {
  return <ProductList />;
}
