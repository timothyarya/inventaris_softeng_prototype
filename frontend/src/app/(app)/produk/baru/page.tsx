import type { Metadata } from "next";
import { ProductCreate } from "@/components/products/product-create";

export const metadata: Metadata = { title: "Tambah Produk" };

export default function ProdukBaruPage() {
  return <ProductCreate />;
}
