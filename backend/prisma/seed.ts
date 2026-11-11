import "dotenv/config";
import bcrypt from "bcrypt";
import { env } from "../src/config/env";
import { prisma } from "../src/config/prisma";
import { jakartaDate } from "../src/utils/datetime";
import { createStockIn } from "../src/modules/stock-ins/service";

// Seed: cabang, user, kategori, produk, dan 1 stok masuk contoh ke gudang (lewat stockService,
// sehingga movement ikut tercatat).
// Idempotent: aman dijalankan berulang kali (upsert, tidak menimpa data yang sudah ada).

const BRANCHES = [
  { code: "GDG", name: "Gudang Utama", address: "Jl. Gudang Raya No. 1, Jakarta", isMain: true },
  { code: "CB01", name: "Cabang 01", address: "Jl. Contoh Satu No. 10, Jakarta", isMain: false },
  { code: "CB02", name: "Cabang 02", address: "Jl. Contoh Dua No. 20, Bandung", isMain: false },
];

const CATEGORIES = ["Alat Tulis", "Elektronik", "Makanan & Minuman"];

const PRODUCTS = [
  { sku: "ATK-001", name: "Pulpen Hitam", category: "Alat Tulis", unit: "pcs", minStock: 50 },
  { sku: "ATK-002", name: "Buku Tulis A5", category: "Alat Tulis", unit: "pcs", minStock: 30 },
  { sku: "ATK-003", name: "Kertas A4 80gr", category: "Alat Tulis", unit: "rim", minStock: 10 },
  { sku: "ATK-004", name: "Spidol Whiteboard", category: "Alat Tulis", unit: "pcs", minStock: 20 },
  { sku: "ELK-001", name: "Kabel USB-C 1m", category: "Elektronik", unit: "pcs", minStock: 15 },
  { sku: "ELK-002", name: "Baterai AA (isi 4)", category: "Elektronik", unit: "box", minStock: 10 },
  { sku: "ELK-003", name: "Lampu LED 9W", category: "Elektronik", unit: "pcs", minStock: 20 },
  {
    sku: "MKN-001",
    name: "Air Mineral 600ml",
    category: "Makanan & Minuman",
    unit: "dus",
    minStock: 20,
  },
  { sku: "MKN-002", name: "Kopi Sachet", category: "Makanan & Minuman", unit: "box", minStock: 10 },
  {
    sku: "MKN-003",
    name: "Gula Pasir 1kg",
    category: "Makanan & Minuman",
    unit: "kg",
    minStock: 25,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(env.SEED_DEFAULT_PASSWORD, 10);

  // Cabang
  for (const b of BRANCHES) {
    await prisma.branch.upsert({ where: { code: b.code }, update: {}, create: b });
  }
  const cb01 = await prisma.branch.findUniqueOrThrow({ where: { code: "CB01" } });
  const cb02 = await prisma.branch.findUniqueOrThrow({ where: { code: "CB02" } });

  // User
  const users = [
    { name: "Owner", email: "owner@softeng.local", role: "OWNER", branchId: null },
    {
      name: "Admin Gudang 1",
      email: "admingudang1@softeng.local",
      role: "ADMIN_GUDANG",
      branchId: null,
    },
    {
      name: "Admin Gudang 2",
      email: "admingudang2@softeng.local",
      role: "ADMIN_GUDANG",
      branchId: null,
    },
    {
      name: "Pegawai Cabang CB01",
      email: "pegawaicabang1@softeng.local",
      role: "PEGAWAI_CABANG",
      branchId: cb01.id,
    },
    {
      name: "Pegawai Cabang CB02",
      email: "pegawaicabang2@softeng.local",
      role: "PEGAWAI_CABANG",
      branchId: cb02.id,
    },
  ] as const;
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: passwordHash },
    });
  }

  // Kategori
  for (const name of CATEGORIES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Produk
  for (const p of PRODUCTS) {
    const category = await prisma.category.findUniqueOrThrow({ where: { name: p.category } });
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        minStock: p.minStock,
        categoryId: category.id,
      },
    });
  }

  // Stok masuk contoh: hanya dibuat jika belum ada stok masuk sama sekali.
  // Sengaja ada produk di bawah stok minimum (ATK-004, ELK-002) dan tanpa stok (MKN-003)
  // agar penanda stok menipis bisa dicoba.
  let sampleStockIn: string | null = null;
  if ((await prisma.stockIn.count()) === 0) {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner@softeng.local" } });
    const qtyBySku: Record<string, number> = {
      "ATK-001": 200,
      "ATK-002": 120,
      "ATK-003": 40,
      "ATK-004": 15,
      "ELK-001": 60,
      "ELK-002": 8,
      "ELK-003": 80,
      "MKN-001": 100,
      "MKN-002": 50,
    };
    const products = await prisma.product.findMany({
      where: { sku: { in: Object.keys(qtyBySku) } },
    });
    const created = await createStockIn(
      {
        date: jakartaDate(),
        supplierName: "PT Supplier Contoh",
        invoiceNo: "INV-CONTOH-001",
        note: "Stok awal contoh dari seed",
        items: products.map((p) => ({ productId: p.id, qty: qtyBySku[p.sku]! })),
      },
      owner.id,
    );
    sampleStockIn = created.docNo;
  }

  console.log("Seed selesai.");
  console.log(`  Cabang   : ${BRANCHES.map((b) => b.code).join(", ")}`);
  console.log(`  Kategori : ${CATEGORIES.length}`);
  console.log(`  Produk   : ${PRODUCTS.length}`);
  console.log(`  Stok masuk contoh : ${sampleStockIn ?? "sudah ada, dilewati"}`);
  console.log("  Akun (password sama untuk semuanya):");
  for (const u of users) console.log(`    ${u.role.padEnd(10)} ${u.email}`);
  console.log(`  Password : ${env.SEED_DEFAULT_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
