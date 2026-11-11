import type { Metadata } from "next";
import { ProductDetail } from "@/components/products/product-detail";

export const metadata: Metadata = { title: "Detail Produk" };

export default function ProdukDetailPage() {
  return <ProductDetail />;
}
