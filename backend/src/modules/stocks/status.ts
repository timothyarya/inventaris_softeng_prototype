/**
 * Status stok per produk di satu cabang (bagian 14):
 * - HABIS    : produk aktif dengan qty 0 (berapa pun stok minimumnya)
 * - MENIPIS  : qty > 0 tetapi di bawah stok minimum (hanya bila stok minimum > 0)
 * - AMAN     : selain itu. Produk nonaktif tidak dipantau, jadi selalu AMAN.
 */
export type StockStatus = "AMAN" | "MENIPIS" | "HABIS";

export function stockStatus(qty: number, minStock: number, isActive: boolean): StockStatus {
  if (!isActive) return "AMAN";
  if (qty === 0) return "HABIS";
  if (minStock > 0 && qty < minStock) return "MENIPIS";
  return "AMAN";
}
