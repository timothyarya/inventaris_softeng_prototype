# INSTRUCTION.md — Sistem Inventaris Multi Cabang

> Dokumen ini adalah spesifikasi lengkap untuk dibangun. Ikuti aturan bisnis **persis seperti tertulis**. Jika ada hal yang ambigu atau tidak tercakup, **berhenti dan tanyakan**, jangan mengarang aturan baru. Kerjakan per fase (lihat bagian 12), dan pastikan kriteria selesai tiap fase terpenuhi sebelum lanjut.

---

## 1. Ringkasan Sistem

Aplikasi web untuk mengelola inventaris di banyak cabang. Ada satu **gudang utama** (yang secara teknis juga sebuah cabang) sebagai satu-satunya tempat stok masuk dari supplier. Stok didistribusikan dari gudang utama ke cabang-cabang lewat **transfer stok**. Ketepatan stok dijaga lewat **stok opname** yang diverifikasi. Setiap perubahan stok tercatat di **riwayat pergerakan stok** (buku besar).

Role: **Owner**, **SuperAdmin**, **Pegawai**.

---

## 2. Tech Stack

| Bagian | Pilihan |
|---|---|
| Frontend | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Data fetching | TanStack Query |
| Form & validasi | React Hook Form + Zod |
| Grafik | Recharts |
| Backend | Node.js + Express 5 + TypeScript (ESM) |
| Database | PostgreSQL 18 (diinstal langsung di Windows, tanpa Docker) |
| ORM | **Prisma 7** + driver adapter `@prisma/adapter-pg` |
| Auth | JWT disimpan di cookie httpOnly, password di-hash dengan bcrypt |
| Validasi backend | Zod |
| Runner TS backend | `tsx` (dev dan seed) |

**Kebijakan versi:** gunakan **versi stabil terbaru** dari setiap paket saat instalasi (bukan beta/RC/canary). Jangan menurunkan versi mayor hanya untuk mencocokkan contoh lama dari ingatan; ikuti dokumentasi resmi versi yang terpasang. Jika sebuah paket terbaru tidak kompatibel dengan paket lain, laporkan dan tanyakan dulu. Node.js minimal 20.19 (disarankan 22 LTS atau lebih baru).

### Aturan khusus Prisma 7 (WAJIB)
Prisma 7 punya banyak perubahan dari Prisma 6. Jangan memakai pola Prisma 6:
- Generator memakai `provider = "prisma-client"` (bukan `prisma-client-js`) dengan `output` wajib, yaitu `../src/generated/prisma`. Folder hasil generate dimasukkan ke `.gitignore`. Import client dari path hasil generate, bukan dari `@prisma/client`.
- Blok `datasource` di schema hanya berisi `provider`. URL koneksi diatur di `backend/prisma.config.ts`.
- `.env` **tidak** dimuat otomatis. `prisma.config.ts` dan entry point server wajib `import "dotenv/config"`.
- `PrismaClient` wajib dibuat dengan adapter:
  ```ts
  import { PrismaPg } from "@prisma/adapter-pg";
  import { PrismaClient } from "../generated/prisma/client";
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  export const prisma = new PrismaClient({ adapter });
  ```
  Buat satu instance saja (singleton) di `src/config/prisma.ts`. Untuk tes, buat instance dengan `DATABASE_URL_TEST`.
- `prisma migrate dev` **tidak** lagi otomatis menjalankan `prisma generate` maupun seed. Sediakan script npm yang menjalankan langkah-langkah ini secara eksplisit (misalnya `db:migrate`, `db:generate`, `db:seed`, `db:reset`).
- Seed dikonfigurasi di `prisma.config.ts` (`migrations.seed`), dijalankan dengan `prisma db seed`.
- Middleware `prisma.$use` sudah dihapus. Jika butuh, gunakan `$extends`.
- Backend memakai ESM (`"type": "module"` di `backend/package.json`). Sesuaikan `tsconfig.json` dengan kebutuhan Prisma 7.

Contoh `backend/prisma.config.ts`:
```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

**Komunikasi FE ↔ BE:** gunakan `rewrites` di `next.config` untuk mem-proxy `/api/*` ke server Express. Dengan begitu cookie bersifat same-origin dan tidak perlu konfigurasi CORS dengan credentials.

### Struktur folder (monorepo)
```
/
├── backend/
│   ├── prisma.config.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── src/
│       ├── app.ts / server.ts
│       ├── generated/prisma/  (hasil prisma generate, di-.gitignore)
│       ├── config/            (prisma.ts singleton, env)
│       ├── middlewares/      (auth, requireRole, errorHandler, validate)
│       ├── modules/
│       │   ├── auth/  branches/  users/  categories/  products/
│       │   ├── stocks/  stock-ins/  transfers/  opnames/
│       │   ├── movements/  dashboard/  reports/
│       │   (tiap modul: routes.ts, controller.ts, service.ts, schema.ts)
│       ├── services/stockService.ts   (SATU-SATUNYA tempat mengubah stok)
│       └── utils/ (docNumber.ts, pagination.ts, errors.ts)
└── frontend/
    └── src/
        ├── app/ (route per halaman, lihat bagian 9)
        ├── components/ (layout, sidebar, tabel, form)
        ├── lib/ (apiClient, auth, permissions)
        └── hooks/
```

---

## 3. Role & Hak Akses

### 3.1 Aturan role
- **Owner** dan **SuperAdmin** tidak terikat cabang (`branch_id = NULL`) dan dapat melihat semua cabang.
- **Pegawai** terikat ke **tepat 1 cabang**. Satu cabang boleh punya banyak pegawai.
- **Gudang utama tidak punya pegawai.** Seluruh operasi gudang utama (stok masuk, pengiriman, opname gudang) dijalankan oleh Owner/SuperAdmin. Pegawai **tidak boleh** di-assign ke gudang utama (validasi di backend).
- Pegawai dengan `branch_id = NULL` (belum/tidak punya cabang) tetap bisa login, tetapi **hanya** melihat halaman "Menunggu penugasan cabang". Semua endpoint data selain `/auth/*` mengembalikan 403 untuk pegawai ini.

### 3.2 Matriks akses

| Fitur | Owner | SuperAdmin | Pegawai |
|---|---|---|---|
| Dashboard | Semua cabang | Semua cabang | Cabangnya sendiri |
| Manajemen Produk & Kategori | CRUD | CRUD | — |
| Inventaris (daftar produk + stok) | Semua cabang (via halaman stok) | Semua cabang | Cabangnya sendiri, read-only |
| Manajemen Cabang | Tambah, edit, nonaktif/aktifkan | — | — |
| Manajemen User | Tambah, edit, nonaktif/aktifkan, assign cabang | — | — |
| Stok Masuk (ke gudang utama) | Ya | Ya | — |
| Transfer: lihat semua pengajuan | Ya | Ya | Hanya milik cabangnya |
| Transfer: setujui/tolak | Ya | Ya | — |
| Transfer: form pengiriman | Ya | Ya | — |
| Transfer: ajukan request stok | — | — | Ya |
| Transfer: batalkan request | — | — | Ya (milik cabangnya, status DIAJUKAN) |
| Transfer: konfirmasi terima | — | — | Ya (cabang tujuan) |
| Stok Opname: buat | Cabang mana pun (termasuk gudang) | Cabang mana pun (termasuk gudang) | Cabangnya sendiri |
| Stok Opname: verifikasi | Ya | Ya | — |
| Riwayat pergerakan stok | Semua cabang | Semua cabang | Cabangnya sendiri |
| Laporan Stok & Distribusi | Ya | Ya | — |

### 3.3 Penegakan akses
- Backend adalah sumber kebenaran. Gunakan middleware `requireRole(...roles)` per route.
- **Scoping pegawai:** untuk pegawai, `branch_id` selalu diambil dari `req.user.branchId` di server. Abaikan parameter `branchId` dari client.
- Middleware auth **memuat ulang user dari DB di setiap request** dan menolak (401) jika `is_active = false`, sehingga penonaktifan berlaku seketika.
- Frontend menyembunyikan menu/tombol sesuai role (`lib/permissions.ts`), tetapi ini hanya untuk UX.

---

## 4. Aturan Bisnis

### 4.1 Cabang
- Field: kode (unik), nama, alamat, telepon, `is_main`, `is_active`.
- Tepat **satu** cabang dengan `is_main = true` (gudang utama). Dibuat lewat seed dan tidak bisa diubah menjadi non-main. Dijaga di dua lapis: validasi di service **dan** partial unique index di database (lihat bagian 6.1).
- **Gudang utama tidak bisa dinonaktifkan.**
- **Nonaktif cabang ditolak** (409) jika masih ada transfer ke cabang tersebut dengan status `DISETUJUI` atau `DIKIRIM`.
- Saat cabang dinonaktifkan, dalam satu transaksi DB:
  1. `branches.is_active = false`
  2. Semua pegawai di cabang itu di-set `branch_id = NULL`, sehingga mereka menunggu penugasan cabang baru.
  3. Request transfer berstatus `DIAJUKAN` ke cabang itu otomatis menjadi `DIBATALKAN` dengan catatan "Cabang dinonaktifkan".
- Cabang nonaktif tidak muncul di pilihan (assign user, tujuan transfer, opname), tetapi **riwayat dan laporannya tetap bisa dilihat**.
- Cabang nonaktif bisa diaktifkan kembali oleh Owner. Pegawai tidak otomatis kembali ke cabang itu.

### 4.2 User
- Field: nama, email (unik), password, role, `branch_id` (nullable), `is_active`.
- Hanya Owner yang mengelola user.
- Role `PEGAWAI` boleh dibuat dengan atau tanpa cabang. Role `OWNER`/`SUPERADMIN` wajib `branch_id = NULL`.
- **Menonaktifkan user tidak memengaruhi cabangnya.** User nonaktif tidak bisa login, dan semua riwayat transaksinya tetap tersimpan.
- Owner tidak bisa menonaktifkan dirinya sendiri. Harus selalu ada minimal 1 Owner aktif.
- Assign/pindah cabang pegawai hanya ke cabang aktif dan bukan gudang utama.

### 4.3 Produk & Kategori
- Produk adalah **master global** (berlaku untuk semua cabang). Stok disimpan per cabang di `branch_stocks`.
- Field produk: SKU (unik), nama, kategori, satuan (pcs, box, kg, dll.), stok minimum (untuk peringatan stok menipis), `is_active`.
- **Hapus produk** hanya diperbolehkan jika produk belum pernah punya pergerakan stok. Jika sudah, tolak (409) dan arahkan untuk **menonaktifkan**.
- Produk nonaktif tidak bisa dipilih di stok masuk, request, pengiriman, atau opname baru, tetapi tetap tampil di riwayat dan laporan.
- Kategori: CRUD sederhana. Hapus ditolak jika masih dipakai produk.

### 4.4 Stok Masuk
- Stok dari supplier **hanya masuk ke gudang utama**. Tidak ada pilihan cabang.
- Diinput oleh Owner/SuperAdmin.
- Field: no. dokumen (otomatis), tanggal, nama supplier (teks bebas), no. faktur (opsional), catatan, daftar item (produk + qty > 0).
- Saat disimpan, setiap item menambah `branch_stocks` gudang utama dan membuat `stock_movements` bertipe `MASUK`.
- Stok masuk bersifat final. Tidak ada edit atau hapus. Koreksi dilakukan lewat opname gudang.

### 4.5 Transfer Stok
- **Hanya satu arah: gudang utama → cabang.** `from_branch_id` selalu gudang utama dan `to_branch_id` selalu cabang aktif non-gudang. Tidak ada transfer antar cabang dan tidak ada retur lewat transfer.
- Dua cara memulai transfer:
  1. **Request dari pegawai**: pegawai mengisi form request untuk cabangnya, status `DIAJUKAN`.
  2. **Pengiriman langsung** oleh Owner/SuperAdmin lewat form pengiriman. Transfer dibuat langsung berstatus `DIKIRIM`, melewati tahap pengajuan dan persetujuan.

**Alur status:**
```
DIAJUKAN ──(pegawai batalkan)──────────────→ DIBATALKAN
DIAJUKAN ──(Owner/SA tolak + alasan wajib)─→ DITOLAK
DIAJUKAN ──(Owner/SA setujui)──────────────→ DISETUJUI
DISETUJUI ─(Owner/SA isi form pengiriman)──→ DIKIRIM
DIKIRIM ───(pegawai cabang tujuan terima)──→ DITERIMA
```
Transisi lain ditolak (409).

**Detail tiap langkah:**
- **Ajukan** (pegawai): item berisi produk + `qty_diminta` > 0, ditambah catatan opsional.
- **Setujui** (Owner/SA): boleh menyesuaikan qty yang akan dikirim. Stok belum berubah.
- **Tolak** (Owner/SA): `alasan_tolak` wajib diisi.
- **Kirim** (Owner/SA): mengisi `qty_dikirim` per item (boleh berbeda dari diminta, ≥ 0, minimal satu item > 0). Dalam satu transaksi:
  - Cek stok gudang utama mencukupi untuk tiap item, dengan row lock. Jika kurang, tolak seluruhnya (422) dengan pesan item mana yang kurang.
  - Kurangi stok gudang, lalu buat movement `TRANSFER_OUT` (qty negatif).
- **Terima** (pegawai cabang tujuan): mengisi `qty_diterima` per item (0 ≤ diterima ≤ dikirim), default = qty_dikirim. Dalam satu transaksi:
  - Tambah stok cabang tujuan sebesar `qty_diterima`, lalu buat movement `TRANSFER_IN`.
  - Selisih (`qty_dikirim − qty_diterima`) **tidak** menjadi pergerakan stok. Selisih ini cukup tercatat di transfer dan tampil di Laporan Distribusi sebagai "selisih kirim".
- Simpan siapa dan kapan untuk setiap langkah (`requested_by/at`, `approved_by/at`, `sent_by/at`, `received_by/at`).

### 4.6 Stok Opname
- Pegawai membuat opname untuk cabangnya. Owner/SA dapat membuat opname untuk cabang aktif mana pun, termasuk gudang utama.
- Saat membuat opname, sistem mengisi daftar produk aktif beserta `qty_sistem` (stok saat itu). User mengisi `qty_fisik` untuk produk yang dihitung. Produk yang tidak diisi tidak disertakan.
- `selisih = qty_fisik − qty_sistem`. Setiap item punya `keterangan` opsional, misalnya "retur ke gudang", "rusak", atau "hilang".
- **Retur tidak punya fitur sendiri.** Barang yang dikembalikan cabang ke gudang tercatat sebagai selisih minus di opname cabang dan selisih plus di opname gudang, dengan keterangan "retur".
- Status: `MENUNGGU` → `DISETUJUI` / `DITOLAK`.
- **Hanya boleh 1 opname berstatus `MENUNGGU` per cabang.** Opname baru ditolak (409) jika masih ada yang menunggu.
- **Setujui** (Owner/SA): dalam satu transaksi, untuk setiap item dengan selisih ≠ 0, tambahkan **selisih** ke stok cabang (bukan menimpa dengan qty_fisik) dan buat movement `OPNAME` sebesar selisih. Alasannya, stok bisa berubah antara waktu hitung dan waktu verifikasi. Stok tidak boleh menjadi negatif. Jika itu terjadi, tolak dengan 422.
- **Tolak** (Owner/SA): catatan verifikasi wajib. Stok tidak berubah, dan pegawai bisa membuat opname baru.

### 4.7 Riwayat Pergerakan Stok
- Sumber data: tabel `stock_movements` (append-only, tidak pernah di-update atau dihapus).
- Filter: cabang (Owner/SA saja), produk, tipe, rentang tanggal. Hasil dipaginasi.
- Kolom: waktu, cabang, produk, tipe, qty (+/−), saldo setelah, no. dokumen referensi (bisa diklik ke detail), user.

### 4.8 Laporan (Owner & SuperAdmin)
Filter umum: **seluruh cabang** atau **pilih cabang**, dan **periode** (tanggal mulai–akhir).

1. **Laporan Stok** per cabang × produk dalam periode:
   - Stok awal = jumlah movement sebelum tanggal mulai
   - Masuk (`MASUK`), Transfer masuk (`TRANSFER_IN`), Transfer keluar (`TRANSFER_OUT`), Penyesuaian opname (`OPNAME`, +/−)
   - Stok akhir = stok awal + seluruh pergerakan dalam periode
   - Tandai produk yang stok akhirnya di bawah stok minimum
2. **Laporan Distribusi** (transfer berstatus `DIKIRIM`/`DITERIMA` dengan `sent_at` dalam periode):
   - Rekap per cabang tujuan: jumlah transfer, total qty dikirim, total qty diterima, total selisih kirim
   - Rincian per produk
   - Rekap status pengajuan dalam periode (DIAJUKAN/DISETUJUI/DITOLAK/DIBATALKAN)

Export (CSV/PDF) **belum** dikerjakan, lihat bagian 13.

### 4.9 Dashboard
- **Owner/SuperAdmin** (seluruh cabang, dengan filter cabang opsional):
  - Kartu: total produk aktif, total cabang aktif, jumlah item stok menipis, request transfer menunggu (`DIAJUKAN`), transfer siap kirim (`DISETUJUI`), opname menunggu verifikasi
  - Tabel stok menipis (cabang, produk, qty, minimum)
  - Grafik distribusi 30 hari terakhir (qty dikirim per cabang)
  - 10 pergerakan stok terbaru
- **Pegawai** (cabangnya sendiri):
  - Kartu: jumlah produk, item stok menipis, request saya yang masih berjalan, kiriman yang perlu dikonfirmasi (`DIKIRIM`)
  - Daftar stok menipis
  - Status opname terakhir
  - 10 pergerakan stok terbaru di cabangnya

### 4.10 Nomor dokumen
Format `PREFIX-YYYYMMDD-NNNN` (nomor urut direset per hari per prefix):
- `SI` stok masuk, `TR` transfer, `OP` opname
- Buat secara aman terhadap request bersamaan memakai tabel `doc_counters` dengan satu query atomik di dalam transaksi yang sama:
  ```sql
  INSERT INTO doc_counters (prefix, date, last_seq) VALUES ($1, $2, 1)
  ON CONFLICT (prefix, date) DO UPDATE SET last_seq = doc_counters.last_seq + 1
  RETURNING last_seq;
  ```
- Tanggal pada nomor dokumen memakai tanggal zona Asia/Jakarta, bukan UTC.

---

## 5. Prinsip Teknis Inti (WAJIB)

1. **Stok tidak pernah diubah langsung.** Semua perubahan `branch_stocks` hanya lewat `stockService.applyMovement(tx, {...})` yang:
   - memastikan baris `branch_stocks` ada (`INSERT ... ON CONFLICT (branch_id, product_id) DO NOTHING` dengan qty 0), lalu menguncinya dengan `SELECT ... FOR UPDATE`. Keduanya via `$queryRaw`/`$executeRaw` di dalam `prisma.$transaction`,
   - memvalidasi bahwa qty hasil tidak negatif (422 jika negatif),
   - memperbarui `branch_stocks.qty`,
   - menulis satu baris `stock_movements` dengan `saldo_setelah`.
2. Setiap aksi yang mengubah stok (stok masuk, kirim, terima, setujui opname) berjalan dalam **satu transaksi DB**. Jika ada yang gagal, semuanya rollback.
3. Validasi transisi status dilakukan di service, dan status saat ini dibaca ulang di dalam transaksi untuk mencegah double-submit.
4. Semua input divalidasi dengan Zod di backend.
5. Format error konsisten: `{ "error": { "code": "STRING", "message": "..." } }` dengan HTTP status yang sesuai (400 validasi, 401, 403, 404, 409 konflik/aturan bisnis, 422 stok tidak cukup/negatif).
6. Waktu disimpan sebagai `timestamptz` (UTC), ditampilkan di zona Asia/Jakarta. Filter tanggal pada riwayat, laporan, dan dashboard memakai batas hari Asia/Jakarta (misalnya 00:00 WIB = 17:00 UTC hari sebelumnya).
7. Qty adalah integer. Satuan hanya label.

---

## 6. Skema Database (Prisma)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  // URL koneksi ada di prisma.config.ts (aturan Prisma 7)
}

enum Role {
  OWNER
  SUPERADMIN
  PEGAWAI
}

enum TransferStatus {
  DIAJUKAN
  DISETUJUI
  DITOLAK
  DIBATALKAN
  DIKIRIM
  DITERIMA
}

enum OpnameStatus {
  MENUNGGU
  DISETUJUI
  DITOLAK
}

enum MovementType {
  MASUK
  TRANSFER_OUT
  TRANSFER_IN
  OPNAME
}

enum RefType {
  STOCK_IN
  TRANSFER
  OPNAME
}

model Branch {
  id        Int      @id @default(autoincrement())
  code      String   @unique @db.VarChar(20)
  name      String   @db.VarChar(100)
  address   String?  @db.VarChar(255)
  phone     String?  @db.VarChar(30)
  isMain    Boolean  @default(false) @map("is_main")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  users         User[]
  stocks        BranchStock[]
  transfersFrom StockTransfer[] @relation("TransferFrom")
  transfersTo   StockTransfer[] @relation("TransferTo")
  opnames       StockOpname[]
  movements     StockMovement[]

  @@map("branches")
}

model User {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(100)
  email     String   @unique @db.VarChar(150)
  password  String   @db.VarChar(255)
  role      Role
  branchId  Int?     @map("branch_id")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  branch Branch? @relation(fields: [branchId], references: [id])

  stockInsCreated    StockIn[]       @relation("StockInCreatedBy")
  transfersRequested StockTransfer[] @relation("TransferRequestedBy")
  transfersApproved  StockTransfer[] @relation("TransferApprovedBy")
  transfersSent      StockTransfer[] @relation("TransferSentBy")
  transfersReceived  StockTransfer[] @relation("TransferReceivedBy")
  opnamesCreated     StockOpname[]   @relation("OpnameCreatedBy")
  opnamesVerified    StockOpname[]   @relation("OpnameVerifiedBy")
  movements          StockMovement[]

  @@map("users")
}

model Category {
  id       Int       @id @default(autoincrement())
  name     String    @unique @db.VarChar(100)
  products Product[]

  @@map("categories")
}

model Product {
  id         Int      @id @default(autoincrement())
  sku        String   @unique @db.VarChar(50)
  name       String   @db.VarChar(150)
  categoryId Int?     @map("category_id")
  unit       String   @db.VarChar(20)
  minStock   Int      @default(0) @map("min_stock")
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  category      Category?           @relation(fields: [categoryId], references: [id])
  stocks        BranchStock[]
  stockInItems  StockInItem[]
  transferItems StockTransferItem[]
  opnameItems   StockOpnameItem[]
  movements     StockMovement[]

  @@map("products")
}

model BranchStock {
  id        Int      @id @default(autoincrement())
  branchId  Int      @map("branch_id")
  productId Int      @map("product_id")
  qty       Int      @default(0)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  branch  Branch  @relation(fields: [branchId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  @@unique([branchId, productId])
  @@map("branch_stocks")
}

model StockIn {
  id           Int      @id @default(autoincrement())
  docNo        String   @unique @map("doc_no") @db.VarChar(30)
  date         DateTime @db.Date
  supplierName String   @map("supplier_name") @db.VarChar(150)
  invoiceNo    String?  @map("invoice_no") @db.VarChar(50)
  note         String?  @db.Text
  createdById  Int      @map("created_by")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  createdBy User          @relation("StockInCreatedBy", fields: [createdById], references: [id])
  items     StockInItem[]

  @@map("stock_ins")
}

model StockInItem {
  id        Int @id @default(autoincrement())
  stockInId Int @map("stock_in_id")
  productId Int @map("product_id")
  qty       Int

  stockIn StockIn @relation(fields: [stockInId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id])

  @@map("stock_in_items")
}

model StockTransfer {
  id            Int            @id @default(autoincrement())
  docNo         String         @unique @map("doc_no") @db.VarChar(30)
  fromBranchId  Int            @map("from_branch_id")
  toBranchId    Int            @map("to_branch_id")
  status        TransferStatus
  note          String?        @db.Text
  rejectReason  String?        @map("reject_reason") @db.Text
  cancelReason  String?        @map("cancel_reason") @db.Text
  requestedById Int?           @map("requested_by")
  approvedById  Int?           @map("approved_by")
  sentById      Int?           @map("sent_by")
  receivedById  Int?           @map("received_by")
  requestedAt   DateTime?      @map("requested_at") @db.Timestamptz(3)
  approvedAt    DateTime?      @map("approved_at") @db.Timestamptz(3)
  sentAt        DateTime?      @map("sent_at") @db.Timestamptz(3)
  receivedAt    DateTime?      @map("received_at") @db.Timestamptz(3)
  createdAt     DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime       @updatedAt @map("updated_at") @db.Timestamptz(3)

  fromBranch  Branch              @relation("TransferFrom", fields: [fromBranchId], references: [id])
  toBranch    Branch              @relation("TransferTo", fields: [toBranchId], references: [id])
  requestedBy User?               @relation("TransferRequestedBy", fields: [requestedById], references: [id])
  approvedBy  User?               @relation("TransferApprovedBy", fields: [approvedById], references: [id])
  sentBy      User?               @relation("TransferSentBy", fields: [sentById], references: [id])
  receivedBy  User?               @relation("TransferReceivedBy", fields: [receivedById], references: [id])
  items       StockTransferItem[]

  @@index([status])
  @@index([toBranchId, status])
  @@map("stock_transfers")
}

model StockTransferItem {
  id           Int  @id @default(autoincrement())
  transferId   Int  @map("transfer_id")
  productId    Int  @map("product_id")
  qtyRequested Int? @map("qty_requested")
  qtyApproved  Int? @map("qty_approved")
  qtySent      Int? @map("qty_sent")
  qtyReceived  Int? @map("qty_received")

  transfer StockTransfer @relation(fields: [transferId], references: [id], onDelete: Cascade)
  product  Product       @relation(fields: [productId], references: [id])

  @@map("stock_transfer_items")
}

model StockOpname {
  id           Int          @id @default(autoincrement())
  docNo        String       @unique @map("doc_no") @db.VarChar(30)
  branchId     Int          @map("branch_id")
  date         DateTime     @db.Date
  status       OpnameStatus @default(MENUNGGU)
  note         String?      @db.Text
  verifyNote   String?      @map("verify_note") @db.Text
  createdById  Int          @map("created_by")
  verifiedById Int?         @map("verified_by")
  verifiedAt   DateTime?    @map("verified_at") @db.Timestamptz(3)
  createdAt    DateTime     @default(now()) @map("created_at") @db.Timestamptz(3)

  branch     Branch            @relation(fields: [branchId], references: [id])
  createdBy  User              @relation("OpnameCreatedBy", fields: [createdById], references: [id])
  verifiedBy User?             @relation("OpnameVerifiedBy", fields: [verifiedById], references: [id])
  items      StockOpnameItem[]

  @@index([branchId, status])
  @@map("stock_opnames")
}

model StockOpnameItem {
  id          Int     @id @default(autoincrement())
  opnameId    Int     @map("opname_id")
  productId   Int     @map("product_id")
  qtySystem   Int     @map("qty_system")
  qtyPhysical Int     @map("qty_physical")
  difference  Int
  remark      String? @db.VarChar(255)

  opname  StockOpname @relation(fields: [opnameId], references: [id], onDelete: Cascade)
  product Product     @relation(fields: [productId], references: [id])

  @@map("stock_opname_items")
}

model StockMovement {
  id         Int          @id @default(autoincrement())
  branchId   Int          @map("branch_id")
  productId  Int          @map("product_id")
  type       MovementType
  qty        Int
  balanceAfter Int        @map("balance_after")
  refType    RefType      @map("ref_type")
  refId      Int          @map("ref_id")
  refDocNo   String       @map("ref_doc_no") @db.VarChar(30)
  userId     Int          @map("user_id")
  createdAt  DateTime     @default(now()) @map("created_at") @db.Timestamptz(3)

  branch  Branch  @relation(fields: [branchId], references: [id])
  product Product @relation(fields: [productId], references: [id])
  user    User    @relation(fields: [userId], references: [id])

  @@index([branchId, productId, createdAt])
  @@index([branchId, createdAt])
  @@index([type, createdAt])
  @@map("stock_movements")
}

model DocCounter {
  prefix  String @db.VarChar(5)
  date    String @db.VarChar(8)
  lastSeq Int    @default(0) @map("last_seq")

  @@id([prefix, date])
  @@map("doc_counters")
}
```

### ERD (Mermaid)

```mermaid
erDiagram
  branches ||--o{ users : "punya pegawai"
  branches ||--o{ branch_stocks : ""
  products ||--o{ branch_stocks : ""
  categories ||--o{ products : ""
  users ||--o{ stock_ins : "membuat"
  stock_ins ||--|{ stock_in_items : ""
  products ||--o{ stock_in_items : ""
  branches ||--o{ stock_transfers : "asal (gudang)"
  branches ||--o{ stock_transfers : "tujuan"
  stock_transfers ||--|{ stock_transfer_items : ""
  products ||--o{ stock_transfer_items : ""
  branches ||--o{ stock_opnames : ""
  stock_opnames ||--|{ stock_opname_items : ""
  products ||--o{ stock_opname_items : ""
  branches ||--o{ stock_movements : ""
  products ||--o{ stock_movements : ""
  users ||--o{ stock_movements : "pelaku"
```

### 6.1 Constraint tambahan (migrasi SQL manual)

Prisma tidak bisa menyatakan constraint berikut di `schema.prisma`. Buat migrasi kosong dengan `npx prisma migrate dev --create-only --name db_constraints`, isi file `migration.sql`-nya dengan SQL di bawah, lalu jalankan `npx prisma migrate dev` dan `npx prisma generate` (Prisma 7 tidak menjalankan generate otomatis).

```sql
-- Hanya boleh ada satu gudang utama
CREATE UNIQUE INDEX branches_single_main ON branches (is_main) WHERE is_main = true;

-- Stok tidak boleh negatif (lapis kedua setelah validasi di stockService)
ALTER TABLE branch_stocks ADD CONSTRAINT branch_stocks_qty_nonneg CHECK (qty >= 0);

-- Qty item harus masuk akal
ALTER TABLE stock_in_items ADD CONSTRAINT stock_in_items_qty_pos CHECK (qty > 0);
ALTER TABLE stock_transfer_items ADD CONSTRAINT transfer_items_qty_nonneg CHECK (
  (qty_requested IS NULL OR qty_requested >= 0) AND
  (qty_approved IS NULL OR qty_approved >= 0) AND
  (qty_sent IS NULL OR qty_sent >= 0) AND
  (qty_received IS NULL OR (qty_received >= 0 AND qty_sent IS NOT NULL AND qty_received <= qty_sent))
);
ALTER TABLE stock_opname_items ADD CONSTRAINT opname_items_qty_nonneg CHECK (qty_physical >= 0 AND qty_system >= 0);

-- Transfer tidak boleh ke cabang asal sendiri
ALTER TABLE stock_transfers ADD CONSTRAINT transfers_diff_branch CHECK (from_branch_id <> to_branch_id);

-- Hanya satu opname MENUNGGU per cabang
CREATE UNIQUE INDEX stock_opnames_one_pending ON stock_opnames (branch_id) WHERE status = 'MENUNGGU';
```

Validasi aturan-aturan ini **tetap dilakukan di service** agar pesan error rapi (409/422). Constraint database hanya pengaman terakhir. Jika constraint dilanggar, error handler menerjemahkan kode error Prisma/PostgreSQL (`P2002` unique, `23514` check) menjadi 409 atau 422, bukan 500.

### Seed (`prisma/seed.ts`)
- 1 cabang gudang utama: kode `GDG`, nama "Gudang Utama", `is_main = true`
- 2 cabang contoh: `CB01`, `CB02`
- User: 1 Owner, 1 SuperAdmin, 2 Pegawai (masing-masing di CB01 dan CB02). Password default dibaca dari `.env` (`SEED_DEFAULT_PASSWORD`) dan dicetak di console saat seed.
- 3 kategori dan ±10 produk contoh
- 1 stok masuk contoh ke gudang. Jalankan lewat `stockService` agar movement ikut tercatat.

---

## 7. API Backend (Express, prefix `/api`)

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | /auth/login | publik | set cookie JWT |
| POST | /auth/logout | login | hapus cookie |
| GET | /auth/me | login | profil + role + cabang |
| GET | /branches | Owner, SA | `?active=` (Pegawai: tidak perlu) |
| POST | /branches | Owner | |
| PATCH | /branches/:id | Owner | edit data |
| PATCH | /branches/:id/deactivate | Owner | aturan 4.1 |
| PATCH | /branches/:id/activate | Owner | |
| GET | /users | Owner | filter role, cabang, status, pencarian |
| POST | /users | Owner | |
| PATCH | /users/:id | Owner | edit + assign cabang + reset password |
| PATCH | /users/:id/deactivate · /activate | Owner | |
| GET/POST/PATCH/DELETE | /categories | Owner, SA | |
| GET | /products | semua (Pegawai: hanya aktif) | pencarian, kategori, status |
| POST/PATCH | /products(/:id) | Owner, SA | |
| PATCH | /products/:id/deactivate · /activate | Owner, SA | |
| DELETE | /products/:id | Owner, SA | aturan 4.3 |
| GET | /stocks | semua | `?branchId=` (dipaksa untuk Pegawai), `?lowOnly=true` |
| GET | /stock-ins | Owner, SA | |
| GET | /stock-ins/:id | Owner, SA | |
| POST | /stock-ins | Owner, SA | |
| GET | /transfers | semua (Pegawai: cabangnya) | filter status, cabang, tanggal |
| GET | /transfers/:id | semua (Pegawai: cabangnya) | |
| POST | /transfers/requests | Pegawai | buat request (DIAJUKAN) |
| POST | /transfers/direct | Owner, SA | pengiriman langsung (DIKIRIM) |
| POST | /transfers/:id/cancel | Pegawai | |
| POST | /transfers/:id/approve | Owner, SA | |
| POST | /transfers/:id/reject | Owner, SA | |
| POST | /transfers/:id/send | Owner, SA | |
| POST | /transfers/:id/receive | Pegawai (cabang tujuan) | |
| GET | /opnames | semua (Pegawai: cabangnya) | |
| GET | /opnames/:id | semua (Pegawai: cabangnya) | |
| GET | /opnames/prefill?branchId= | semua | daftar produk + qty_sistem |
| POST | /opnames | semua | aturan 4.6 |
| POST | /opnames/:id/approve | Owner, SA | |
| POST | /opnames/:id/reject | Owner, SA | |
| GET | /movements | semua (Pegawai: cabangnya) | filter + paginasi |
| GET | /dashboard | semua | isi sesuai role (4.9) |
| GET | /reports/stock | Owner, SA | `branchId?`, `from`, `to` |
| GET | /reports/distribution | Owner, SA | `branchId?`, `from`, `to` |

List endpoint memakai paginasi `?page=&pageSize=` dan mengembalikan `{ data, meta: { page, pageSize, total } }`.

---

## 8. Menu Sidebar per Role

**Owner**
1. Dashboard
2. Produk (Produk, Kategori)
3. Cabang
4. User
5. Stok Masuk
6. Transfer Stok (Semua Pengajuan, Form Pengiriman)
7. Stok Opname
8. Riwayat Stok
9. Laporan (Stok, Distribusi)

**SuperAdmin**: sama dengan Owner tanpa menu **Cabang** dan **User**.

**Pegawai**
1. Dashboard
2. Inventaris
3. Request Stok (Buat Request, Request Saya, Kiriman Masuk)
4. Stok Opname
5. Riwayat Stok

Header menampilkan nama user, role, nama cabang (Pegawai), dan tombol logout.

---

## 9. Sitemap / Route Frontend (Next.js App Router)

| Route | Role | Isi |
|---|---|---|
| `/login` | publik | form login |
| `/menunggu-penugasan` | Pegawai tanpa cabang | info + logout |
| `/dashboard` | semua | sesuai role |
| `/produk` | Owner, SA | tabel produk + cari/filter, aktif/nonaktif |
| `/produk/baru`, `/produk/[id]` | Owner, SA | form produk + stok produk ini di semua cabang |
| `/kategori` | Owner, SA | CRUD kategori (dialog) |
| `/inventaris` | Pegawai | produk + stok cabangnya, penanda stok menipis |
| `/stok` | Owner, SA | stok per cabang (pilih cabang), penanda menipis |
| `/cabang`, `/cabang/baru`, `/cabang/[id]` | Owner | daftar, form, detail (pegawai & ringkasan stok), nonaktif/aktifkan |
| `/users`, `/users/baru`, `/users/[id]` | Owner | daftar, form, assign cabang, nonaktif/aktifkan |
| `/stok-masuk`, `/stok-masuk/baru`, `/stok-masuk/[id]` | Owner, SA | daftar, form multi-item, detail |
| `/transfer` | Owner, SA | semua pengajuan, dengan tab per status |
| `/transfer/kirim` | Owner, SA | form pengiriman langsung |
| `/transfer/[id]` | semua (scoped) | detail + timeline status + tombol aksi sesuai role & status |
| `/request-stok` | Pegawai | tab: Request Saya, Kiriman Masuk (DIKIRIM, perlu dikonfirmasi) |
| `/request-stok/baru` | Pegawai | form request multi-item |
| `/opname` | semua (scoped) | daftar opname + status |
| `/opname/baru` | semua | pilih cabang (Owner/SA) → isi qty fisik & keterangan |
| `/opname/[id]` | semua (scoped) | detail + selisih; tombol setujui/tolak untuk Owner/SA |
| `/riwayat` | semua (scoped) | tabel movement + filter |
| `/laporan/stok` | Owner, SA | filter cabang/periode + tabel |
| `/laporan/distribusi` | Owner, SA | filter cabang/periode + rekap & rincian |

Akses route yang tidak sesuai role mengarah ke halaman 403. Pegawai tanpa cabang selalu diarahkan ke `/menunggu-penugasan`.

---

## 10. Pedoman UI

- Layout: sidebar kiri + header. Responsif, sidebar menjadi drawer di mobile.
- Tabel: paginasi, pencarian, filter, dan empty state.
- Form multi-item (stok masuk, request, kirim, opname): baris dinamis dengan pencarian produk (combobox), serta validasi qty > 0 dan produk tidak duplikat.
- Badge status dengan warna konsisten: DIAJUKAN (kuning), DISETUJUI (biru), DIKIRIM (ungu), DITERIMA (hijau), DITOLAK/DIBATALKAN (merah/abu), MENUNGGU (kuning).
- Aksi berisiko (nonaktif, tolak, kirim, setujui opname) memakai dialog konfirmasi.
- Notifikasi sukses/gagal dengan toast, menampilkan `error.message` dari backend.
- Angka diformat dengan locale `id-ID`, tanggal ditampilkan dalam zona Asia/Jakarta.
- Bahasa antarmuka: Bahasa Indonesia.

---

## 11. Konfigurasi & Menjalankan

`.env` backend:
```
DATABASE_URL="postgresql://postgres:PASSWORD_ANDA@localhost:5432/softeng_inventaris?schema=public"
DATABASE_URL_TEST="postgresql://postgres:PASSWORD_ANDA@localhost:5432/softeng_inventaris_test?schema=public"
JWT_SECRET="ganti-ini"
JWT_EXPIRES_IN="1d"
PORT=4000
SEED_DEFAULT_PASSWORD="password123"
```
`.env.local` frontend:
```
BACKEND_URL="http://localhost:4000"
```
**Database:** PostgreSQL 18 sudah terinstal langsung di Windows (installer resmi, termasuk pgAdmin) dan berjalan sebagai service di port 5432. **Jangan** membuat `docker-compose.yml` atau mengasumsikan Docker tersedia. Lingkungan pengembangan adalah Windows, jadi script di `package.json` harus berjalan di PowerShell (hindari sintaks khusus bash; gunakan `cross-env` bila perlu set variabel environment).

Sebelum Fase 0, user membuat dua database secara manual lewat pgAdmin atau `psql`:
```sql
CREATE DATABASE softeng_inventaris;
CREATE DATABASE softeng_inventaris_test;
```

Buat `README.md` di root berisi langkah instalasi dependensi, pembuatan database, urutan perintah database (`prisma migrate dev` → `prisma generate` → `prisma db seed`, atau script npm yang membungkusnya), dan cara menjalankan kedua aplikasi.

---

## 12. Fase Pengerjaan

Kerjakan berurutan. Di akhir tiap fase, jalankan aplikasi dan cek kriteria selesai.

**Fase 0 — Setup**
Monorepo, TypeScript di kedua sisi, backend ESM, Prisma 7 (`prisma.config.ts`, adapter-pg, client singleton) + migrasi pertama, migrasi constraint (bagian 6.1), seed, ESLint/Prettier, proxy rewrites Next.js → Express.
✅ Migrasi, `prisma generate`, dan `prisma db seed` berhasil lewat script npm. Constraint 6.1 terpasang. FE dan BE berjalan, `/api/health` (dengan `SELECT 1`) bisa diakses dari FE. Laporkan versi paket utama yang terpasang (Next.js, React, Express, Prisma, Tailwind, Zod, TypeScript).

**Fase 1 — Auth & RBAC & Layout**
Login/logout/me, middleware auth (cek is_active tiap request), `requireRole`, scoping pegawai, layout + sidebar per role, halaman 403 dan `/menunggu-penugasan`.
✅ Ketiga role login dan melihat menu yang benar. User nonaktif tidak bisa mengakses API.

**Fase 2 — Data Master**
Cabang (termasuk aturan nonaktif 4.1), User, Kategori, Produk.
✅ Semua aturan 4.1–4.3 berjalan. Nonaktif cabang mengosongkan cabang pegawainya.

**Fase 3 — Stock Service & Stok Masuk**
`stockService.applyMovement`, generator nomor dokumen, halaman Stok Masuk, halaman `/stok` dan `/inventaris`.
✅ Stok masuk menambah stok gudang dan membuat movement. Saldo konsisten.

**Fase 4 — Transfer Stok**
Seluruh alur 4.5 untuk semua role, termasuk pengiriman langsung.
✅ Semua transisi valid berjalan dan transisi tidak valid ditolak. Stok gudang tidak bisa minus.

**Fase 5 — Stok Opname**
Alur 4.6.
✅ Penyesuaian memakai selisih. Hanya ada 1 opname MENUNGGU per cabang.

**Fase 6 — Riwayat Pergerakan Stok**
✅ Filter dan paginasi berjalan, pegawai hanya melihat cabangnya.

**Fase 7 — Dashboard**
✅ Angka di dashboard cocok dengan data di halaman terkait.

**Fase 8 — Laporan**
✅ Untuk setiap cabang × produk: stok awal + pergerakan = stok akhir, dan stok akhir periode berjalan = `branch_stocks.qty`.

**Fase 9 — Pengujian & Rapikan**
Tes integrasi backend (Vitest + Supertest) memakai database PostgreSQL terpisah (`DATABASE_URL_TEST`), yang di-reset dan di-migrate sebelum tes berjalan. Ingat bahwa di Prisma 7, URL migrasi dibaca dari `prisma.config.ts`, jadi atur agar perintah migrasi untuk tes memakai `DATABASE_URL_TEST` (misalnya lewat variabel environment yang di-set dengan `cross-env`). Tes minimal untuk skenario di bawah, lalu README.

### Skenario uji wajib
1. Stok masuk 100 ke gudang → stok gudang 100, 1 movement MASUK.
2. Pegawai CB01 request 30 → disetujui → dikirim 30 → gudang 70, movement TRANSFER_OUT −30. Stok CB01 belum berubah.
3. Pegawai CB01 menerima 28 → CB01 = 28, movement TRANSFER_IN +28. Selisih kirim 2 tampil di laporan distribusi dan tidak menjadi movement.
4. Kirim melebihi stok gudang → 422, tidak ada perubahan apa pun.
5. Dua request "kirim" bersamaan untuk transfer yang sama → hanya satu yang berhasil.
6. Pegawai CB02 mencoba melihat/menerima transfer CB01 → 403/404.
7. Opname CB01 qty_fisik 25 (sistem 28) → disetujui → CB01 = 25, movement OPNAME −3.
8. Membuat opname kedua saat masih ada yang MENUNGGU → 409.
9. Nonaktif CB01 saat ada transfer DIKIRIM → 409. Setelah transfer DITERIMA → berhasil, pegawai CB01 menjadi tanpa cabang, request DIAJUKAN menjadi DIBATALKAN.
10. Nonaktif gudang utama → ditolak.
11. User dinonaktifkan saat sedang login → request berikutnya 401.
12. Hapus produk yang sudah punya movement → 409.
13. Pegawai mengirim `branchId` cabang lain di query → tetap hanya mendapat data cabangnya.
14. Insert cabang kedua dengan `is_main = true` langsung lewat SQL → ditolak oleh database.
15. Dua request stok masuk bersamaan pada hari yang sama → nomor dokumen berbeda dan berurutan, tanpa duplikat.

---

## 13. Di Luar Lingkup (Ditunda)

Jangan dikerjakan kecuali diminta:
- Stok keluar karena penjualan/pemakaian di cabang
- Transfer antar cabang dan fitur retur khusus
- Tipe movement untuk barang hilang saat pengiriman
- Export laporan (CSV/Excel/PDF)
- Notifikasi (email/real-time)
- Tabel supplier terstruktur (sekarang teks bebas)
- Audit log umum di luar `stock_movements`
- Harga/nilai stok

---

## 14. Keputusan Tambahan

Keputusan di bagian ini melengkapi bagian 1–13. Jika ada pertentangan dengan bagian lain, bagian 14 yang berlaku.

### Setup & proses
- Prisma 7 dan versi stabil terbaru untuk semua paket (lihat bagian 2).
- Seed Fase 0 hanya berisi cabang (`GDG`, `CB01`, `CB02`), user, kategori, dan produk contoh. **Stok masuk contoh ditambahkan di Fase 3** lewat `stockService`.
- Akun seed (password dari `SEED_DEFAULT_PASSWORD`): `owner@softeng.local` (Owner), `superadmin@softeng.local` (SuperAdmin), `pegawai1@softeng.local` (Pegawai CB01), `pegawai2@softeng.local` (Pegawai CB02).
- `/api/health` menjalankan `SELECT 1` ke database.
- Monorepo memakai **npm workspaces** (`backend`, `frontend`), dengan script root yang berjalan di PowerShell.
- Fase 0 di frontend hanya memasang Next.js, TypeScript, Tailwind, dan shadcn/ui (init). TanStack Query, React Hook Form, Zod, dan Recharts dipasang saat pertama kali dipakai.
- Repo memakai git. Buat commit di akhir setiap fase. `.gitignore` mencakup `node_modules`, `.env*` (kecuali `.env.example`), `.next`, dan `backend/src/generated`.
- `backend/.env` dibuat sendiri oleh user. Repo hanya menyediakan `backend/.env.example` dengan placeholder.

### Transfer
- Tambah kolom `qty_approved` di `stock_transfer_items`. Saat **approve**, isi `qty_approved` per item (default = `qty_requested`, boleh disesuaikan). Form **kirim** terisi otomatis dari `qty_approved` dan masih boleh diubah. Pada pengiriman langsung, `qty_requested` dan `qty_approved` bernilai null.
- Item dengan `qty_sent = 0` atau `qty_received = 0` **tidak** membuat movement.
- Produk yang dinonaktifkan setelah transfer berstatus `DISETUJUI`/`DIKIRIM` tetap boleh dikirim dan diterima. Larangan produk nonaktif hanya berlaku untuk dokumen baru.
- Pegawai yang mengakses transfer atau dokumen milik cabang lain mendapat **404**.

### Cabang
- Saat cabang dinonaktifkan, opname berstatus `MENUNGGU` di cabang itu otomatis menjadi `DITOLAK` dalam transaksi yang sama, dengan `verify_note` "Cabang dinonaktifkan" dan `verified_by` = user yang menonaktifkan. Ini menambah langkah 4.1 yang sudah ada.

### User
- Owner boleh mengubah role user. Jika berubah menjadi Owner/SuperAdmin, `branch_id` dikosongkan. Jika berubah menjadi Pegawai, cabang boleh kosong. Owner aktif terakhir tidak boleh diturunkan role-nya.

### Menu
- Owner dan SuperAdmin mendapat menu **Stok Cabang** (route `/stok`), diletakkan tepat setelah menu Produk.

### Stok menipis
- Definisi: `qty < min_stock`, hanya untuk produk aktif dengan `min_stock > 0`. Produk tanpa baris `branch_stocks` dianggap qty 0. Gudang utama ikut dihitung di dashboard Owner/SA.

### Dashboard
- "Request saya yang masih berjalan" berarti status `DIAJUKAN`, `DISETUJUI`, atau `DIKIRIM`.

### Laporan Distribusi
- Rekap status pengajuan hanya mencakup transfer yang berasal dari request (`requested_at` tidak null), difilter berdasarkan `requested_at`, dan dikelompokkan menurut status saat ini.
- Pengiriman langsung ditampilkan sebagai baris terpisah "Pengiriman langsung", difilter berdasarkan `sent_at`.

### Implementasi Fase 1 (auth & layout)
- Respons objek tunggal memakai `{ "data": ... }` (konsisten dengan list `{ data, meta }`). `POST /auth/login` dan `GET /auth/me` mengembalikan `{ data: user }`. `POST /auth/logout` mengembalikan 204.
- Cookie JWT bernama `token`: `httpOnly`, `SameSite=Lax`, `Secure` hanya saat `NODE_ENV=production`, `maxAge` mengikuti `JWT_EXPIRES_IN`. Token hanya memuat id user (`sub`); role dan cabang selalu dimuat ulang dari DB di setiap request.
- Login gagal (email tidak terdaftar atau password salah) selalu 401 dengan pesan yang sama. Akun nonaktif baru diberi tahu ("Akun Anda dinonaktifkan") setelah password terbukti benar.
- Semua rute data di bawah `/api` (selain `/api/health` dan `/api/auth/*`) dilewatkan `authenticate` lalu `requireAssignedBranch` (Pegawai tanpa cabang mendapat 403). Rute tak dikenal tanpa login mengembalikan 401, dengan login 404.
- Frontend: route `(app)` dijaga `AppShell` (401 -> `/login`, Pegawai tanpa cabang -> `/menunggu-penugasan`, role tidak berhak -> halaman 403). Route di sitemap yang belum dibuat ditangkap `[...slug]` sehingga penjaga tetap berlaku dan halaman "tidak ditemukan" tampil di dalam layout.

### Implementasi Fase 2 (data master)
- **Password:** minimal 8 dan maksimal 72 karakter (batas bcrypt), berlaku untuk user baru dan reset password. Hash bcrypt cost 10; password tidak pernah dikembalikan API.
- **`GET /branches`** mengembalikan semua cabang (aktif dan nonaktif), diurutkan gudang utama dulu lalu kode. Filter opsional `?active=true|false`, `?q=` (kode/nama), dan paginasi. Daftar ini boleh dibaca Owner dan SuperAdmin (untuk dropdown/filter di halaman lain); semua rute cabang lainnya hanya Owner. Cabang yang tidak ada dijawab 404.
- **Kode cabang:** hanya huruf besar dan angka, 2–20 karakter; input huruf kecil dinormalisasi ke huruf besar; unik. Kode **tidak dapat diubah** setelah dibuat (`PATCH /branches/:id` hanya menerima `name`, `address`, `phone`; mengirim `code`, `isMain`, atau `isActive` ditolak 400). Cabang baru selalu `is_main = false`.
- **Penulisan cabang di UI:** di semua tempat kode cabang ditampilkan, nama cabang ikut ditampilkan dengan format `KODE — Nama` (contoh `CB01 — Cabang 01`), lewat helper `formatBranch` di frontend.
- **Endpoint tambahan** di luar tabel bagian 7, dibutuhkan halaman detail: `GET /branches/:id` (cabang + daftar pegawai + ringkasan stok: produk aktif, produk ada stok, total qty, stok menipis), `GET /users/:id`, dan `GET /products/:id`. Hak aksesnya sama dengan rute induknya (cabang dan user: Owner; produk: Owner dan SuperAdmin).
- **Filter user:** `GET /users` menerima `q`, `role`, `status=active|inactive`, dan `branchId` (id cabang atau `none` untuk yang belum punya cabang). Di UI, "Pegawai tanpa cabang" memaksa `role=PEGAWAI`.
- **Respons penonaktifan cabang** memuat `effects`: `usersReleased`, `transfersCancelled`, `opnamesRejected`. Pengaktifan kembali cabang tidak mengembalikan pegawai.
- **Kode error bisnis (409):** `MAIN_BRANCH_PROTECTED`, `BRANCH_STATE_UNCHANGED`, `BRANCH_HAS_OPEN_TRANSFERS`, `MAIN_BRANCH_NO_STAFF`, `BRANCH_INACTIVE`, `LAST_OWNER`, `SELF_DEACTIVATE`, `USER_STATE_UNCHANGED`, `EMAIL_DUPLICATE`, `SKU_DUPLICATE`, `CATEGORY_DUPLICATE`, `CATEGORY_IN_USE`, `PRODUCT_HAS_MOVEMENTS`, `PRODUCT_IN_DOCUMENTS`. Pelanggaran foreign key yang lolos dipetakan ke 409 "Data masih dipakai oleh data lain."
- **Hapus produk** ditolak (409) bila sudah punya movement **atau** sudah tercantum di dokumen (transfer/opname); produk seperti itu cukup dinonaktifkan. Nama kategori dan SKU unik tanpa memedulikan huruf besar/kecil; SKU di-trim.
- **`GET /products`** untuk Pegawai hanya mengembalikan produk aktif. Di frontend halaman `/produk` dan `/kategori` tetap hanya untuk Owner dan SuperAdmin (sitemap bagian 9).
- **Frontend:** setelah simpan berhasil, halaman detail dimuat ulang dan form diinisialisasi ulang lewat `key={updatedAt}`; karena itu aksi di halaman detail memakai `mutateAsync` (callback `mutate()` hilang saat komponen di-remount).

### Implementasi Fase 3 (stock service & stok masuk)
- **`stockService.applyMovement(tx, input)`** (`backend/src/services/stockService.ts`) adalah satu-satunya jalan mengubah `branch_stocks`. Parameter `delta` bertanda (positif menambah, negatif mengurangi, tidak boleh 0 atau desimal). Saldo hasil negatif ditolak **422 `INSUFFICIENT_STOCK`**; saldo melebihi batas integer 32-bit ditolak **422 `STOCK_OVERFLOW`**. `stock_movements.qty` menyimpan nilai bertanda (+/−) dan `balance_after` saldo setelahnya. Bila banyak item diproses dalam satu transaksi, urutkan berdasarkan `productId` agar urutan penguncian baris konsisten (anti-deadlock).
- **Nomor dokumen** (`backend/src/services/docNumber.ts`, `generateDocNo(tx, prefix)`): format `PREFIX-YYYYMMDD-NNNN` dengan query atomik pada `doc_counters`, tanggal WIB. Tanggal pada nomor adalah **tanggal pembuatan dokumen (hari ini, WIB)**, bukan tanggal faktur yang diisi user. Counter ikut rollback bila transaksi gagal, sehingga tidak ada nomor yang bolong.
- **Stok masuk:** tanggal dokumen boleh diisi mundur (mis. tanggal faktur lama), default hari ini (WIB), dan **tidak boleh di masa depan** (400). Produk yang sama di dua baris item **ditolak** (400, "Produk dipilih lebih dari sekali"); di form, produk yang sudah dipilih tidak ditawarkan lagi di baris lain. Qty per item 1–1.000.000 (mencegah salah ketik) dan maksimal 200 baris item per dokumen. Produk nonaktif ditolak 409 `PRODUCT_INACTIVE`; gudang utama nonaktif ditolak 409 `MAIN_BRANCH_INACTIVE`. Tidak ada endpoint ubah/hapus (final). Form meminta konfirmasi sebelum menyimpan.
- **`GET /stock-ins`** mendukung `?q=` (no. dokumen, supplier, no. faktur), `?from=` dan `?to=` (tanggal dokumen, YYYY-MM-DD), serta paginasi; diurutkan tanggal lalu id terbaru. Daftar memuat `itemCount` dan `totalQty`; `GET /stock-ins/:id` memuat item beserta produknya.
- **`GET /stocks`** (semua role) mengembalikan baris cabang × produk: `{ branch, product, qty, isLow }`. Parameter: `branchId` (diabaikan untuk Pegawai, selalu cabangnya), `productId`, `q` (SKU/nama), `lowOnly=true`, paginasi. Tanpa `branchId`, Owner/SuperAdmin mendapat semua **cabang aktif** (cabang nonaktif hanya muncul bila dipilih langsung lewat `branchId`). Produk tanpa baris `branch_stocks` dihitung qty 0. Produk nonaktif hanya tampil bila masih ada stoknya, dan tidak pernah tampil untuk Pegawai. `isLow` mengikuti definisi stok menipis di atas. `branchId` atau `productId` yang tidak ada dijawab 404.
- **`/stok`** (Owner/SuperAdmin): dropdown semua cabang (cabang nonaktif diberi tanda), default gudang utama, pencarian, dan filter "stok menipis saja". **`/inventaris`** (Pegawai): tampilan yang sama untuk cabangnya sendiri, tanpa dropdown. `/produk/[id]` menampilkan stok produk di semua cabang aktif.
- **Seed** menambah satu stok masuk contoh (`PT Supplier Contoh`, 9 produk) lewat `createStockIn`, hanya bila belum ada stok masuk sama sekali. Sengaja ada produk di bawah stok minimum (ATK-004, ELK-002) dan tanpa stok (MKN-003) agar penanda stok menipis bisa dicoba.

### Implementasi Fase 4 (transfer stok)
- **Endpoint** (modul `transfers`, semua di bawah `/api/transfers`): `GET /` dan `GET /:id` (semua role; Pegawai hanya transfer menuju cabangnya, selain itu 404), `POST /requests` (Pegawai), `POST /direct` (Owner/SuperAdmin), `POST /:id/cancel` (Pegawai), `POST /:id/approve`, `/:id/reject`, `/:id/send` (Owner/SuperAdmin), `POST /:id/receive` (Pegawai). Respons objek tunggal `{ data: transfer }`. Aksi yang menerima daftar item (`approve`, `send`, `receive`) boleh dipanggil tanpa body: nilai bawaannya dipakai.
- **Request Pegawai:** selalu untuk cabang Pegawai sendiri (`toBranchId` di body diabaikan). Produk ganda dalam satu dokumen **ditolak** (400), qty per item 1–1.000.000, maksimal 200 baris. Request **boleh memuat produk yang stok gudangnya 0**: stok baru dicek saat Kirim. Form request Pegawai tidak menampilkan stok gudang; form pengiriman langsung (Owner/SA) menampilkan stok gudang di samping tiap produk dan memberi peringatan bila qty melebihi stok.
- **Pengiriman langsung:** tujuan harus cabang aktif non-gudang (404 bila tidak ada, 409 `MAIN_BRANCH_NOT_DESTINATION`, 409 `BRANCH_INACTIVE`). Aturan produk/qty sama dengan request. Transfer langsung dibuat berstatus `DIKIRIM` dan stok gudang langsung berkurang; `qty_requested` dan `qty_approved` bernilai null serta `requested_by/at` kosong. Jenis ("Request cabang" / "Pengiriman langsung") ditentukan dari `requested_at` terisi atau tidak (`origin` = `REQUEST` | `DIRECT`).
- **Setujui:** mengisi `qty_approved` (bawaan = `qty_requested`, boleh disesuaikan per item, boleh 0). Minimal satu item harus > 0 (400). **Kirim:** jumlah kirim terisi dari `qty_approved` dan boleh diubah; minimal satu item > 0. Setujui tidak mengubah stok.
- **Tolak:** alasan wajib (1–1000 karakter, spasi saja ditolak). Karena skema tidak punya kolom pengambil keputusan terpisah, **yang menolak dicatat di `approved_by/approved_at`**. **Batalkan** (Pegawai, hanya DIAJUKAN) tidak meminta alasan; pembatalan otomatis oleh penonaktifan cabang mengisi `cancel_reason` "Cabang dinonaktifkan".
- **Kirim** mengunci baris stok gudang, mengumpulkan **semua** item yang kurang, dan menolak seluruh pengiriman dengan **422 `INSUFFICIENT_STOCK`** yang menyebut SKU, nama, stok tersedia, dan jumlah dibutuhkan; status dan stok tidak berubah, nomor dokumen tidak terpakai. Bila cukup, mengurangi stok per item lewat `stockService` (`TRANSFER_OUT`, negatif, urut `productId`). Item ber-qty 0 tidak membuat movement.
- **Terima:** hanya Pegawai cabang tujuan. Jumlah diterima per item 0 … `qty_sent` (lebih dari dikirim = 400); bawaan = `qty_sent`. Semua item boleh 0. Stok cabang bertambah sebesar jumlah diterima (`TRANSFER_IN`); item ber-qty 0 tidak membuat movement. **Selisih** (`qty_sent − qty_received`) tidak menjadi movement; ditampilkan di detail (`shortfall`, null sebelum diterima) dan nanti di Laporan Distribusi.
- **Konkurensi:** setiap aksi mengunci baris transfer (`FOR UPDATE`) lalu membaca ulang status di dalam transaksi; transisi yang tidak valid atau aksi ganda dijawab **409 `INVALID_TRANSITION`**. Produk nonaktif setelah dokumen DISETUJUI/DIKIRIM tetap dapat dikirim/diterima (larangan produk nonaktif hanya untuk dokumen baru; 409 `PRODUCT_INACTIVE`).
- **`GET /transfers`:** `page`, `pageSize`, `q` (no. dokumen atau kode/nama cabang tujuan), `status` (satu atau beberapa dipisah koma), `branchId` (cabang tujuan; diabaikan untuk Pegawai), `origin=request|direct`, `from`/`to` (tanggal dibuat, WIB, inklusif; `from > to` = 400). Diurutkan terbaru dulu. Daftar dan detail memuat `itemCount`, `totalRequested`, `totalSent`, `totalReceived` (null bila belum relevan). Detail memuat siapa dan kapan tiap langkah (`requestedBy`, `approvedBy`, `sentBy`, `receivedBy` beserta waktunya) serta, **hanya untuk Owner/SA pada status DIAJUKAN/DISETUJUI**, `warehouseStock` per item.
- **Frontend:** `/transfer` (tab per status + filter cabang, jenis, tanggal, pencarian), `/transfer/kirim`, `/transfer/[id]` (riwayat proses, tabel item dengan kolom sesuai tahap, tombol aksi menurut role dan status; dialog qty untuk setujui/kirim/terima, dialog alasan untuk tolak, konfirmasi untuk batalkan), `/request-stok` (tab "Request Saya" dan "Kiriman Masuk" lewat `?tab=masuk`), `/request-stok/baru`. Saat pengiriman gagal 422, dialog tetap terbuka dan pesan menyebut item yang kurang.
