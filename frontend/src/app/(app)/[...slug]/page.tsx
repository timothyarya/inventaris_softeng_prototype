import { notFound } from "next/navigation";

// Menangkap route yang belum ada agar tetap melewati penjaga akses di (app)/layout:
// role yang tidak berhak melihat 403, selain itu halaman "tidak ditemukan" di dalam layout.
export default function CatchAllPage() {
  notFound();
}
