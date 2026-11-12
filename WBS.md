# WBS.md — Sistem Inventaris Multi Cabang

Work Breakdown Structure (WBS) berdasarkan aplikasi yang telah dibangun. Penomoran bertingkat: paket kerja utama (1.), sub-paket (1.1.), dan rincian pekerjaan (1.1.1.). Paket utama yang berasal dari fase pengerjaan diberi rujukan fase (INSTRUCTION.md bagian 12); hash commit tiap fase ada di `PROGRESS.md`. Status semua paket: **selesai**, kecuali bagian 14 (belum dikerjakan).

_Terakhir diperbarui: 2026-11-13._

## 1. Manajemen dan Dokumentasi Proyek

**1.1. Spesifikasi dan aturan kerja**

- 1.1.1. Penyusunan spesifikasi proyek (`INSTRUCTION.md`: aturan bisnis, model data, API, sitemap, fase, lingkup)
- 1.1.2. Aturan kerja untuk agen (`CLAUDE.md`: kerjakan per fase, di luar lingkup tidak dikerjakan, tanyakan bila ambigu)
- 1.1.3. Pencatatan keputusan tambahan per fase (`INSTRUCTION.md` bagian 14)

**1.2. Pelaporan dan pencatatan status**

- 1.2.1. Laporan di akhir tiap fase (hasil, penyimpangan, cara mengecek)
- 1.2.2. Catatan status, cara menjalankan, keputusan, dan masalah terbuka (`PROGRESS.md`)
- 1.2.3. Panduan instalasi dan penggunaan (`README.md`)
- 1.2.4. Struktur kerja proyek (`WBS.md`)

**1.3. Manajemen versi**

- 1.3.1. Repositori Git, branch `main`, satu commit per fase
- 1.3.2. Publikasi ke GitHub (`origin/main`)

## 2. Fondasi Teknis (Fase 0)

**2.1. Struktur proyek**

- 2.1.1. Monorepo npm workspaces (`backend` dan `frontend`)
- 2.1.2. Script root (`dev:be`, `dev:fe`, `lint`, `typecheck`, `format`, `test`, `db:*`) yang berjalan di PowerShell
- 2.1.3. Persetujuan install script paket (`allowScripts`)

**2.2. Backend**

- 2.2.1. Express 5 (ESM) dan TypeScript, dijalankan dengan `tsx`
- 2.2.2. Validasi konfigurasi `.env` dengan Zod (`DATABASE_URL`, `DATABASE_URL_TEST`, `JWT_SECRET`, dst.)
- 2.2.3. Endpoint kesehatan `/api/health` (dengan `SELECT 1`)
- 2.2.4. Penanganan error terpusat (`AppError`, helper 400/401/403/404/409/422)

**2.3. Frontend**

- 2.3.1. Next.js 16 (App Router), React 19, Tailwind CSS 4
- 2.3.2. Komponen dasar shadcn/ui (style `base-nova`, Base UI)
- 2.3.3. Proxy `/api/*` dari Next.js ke Express (same-origin)
- 2.3.4. TanStack Query sebagai lapisan data

**2.4. Kualitas kode**

- 2.4.1. ESLint (backend dan frontend)
- 2.4.2. Prettier dan `format:check`
- 2.4.3. Pemeriksaan tipe (`typecheck`) di kedua sisi

## 3. Basis Data

**3.1. Perancangan skema (Prisma 7, PostgreSQL 18)**

- 3.1.1. Enum: `Role`, `TransferStatus`, `OpnameStatus`, `MovementType`, `RefType`
- 3.1.2. Tabel master: `branches`, `users`, `categories`, `products`
- 3.1.3. Tabel stok: `branch_stocks`, `stock_ins` dan `stock_in_items`
- 3.1.4. Tabel transfer: `stock_transfers` dan `stock_transfer_items`
- 3.1.5. Tabel opname: `stock_opnames` dan `stock_opname_items`
- 3.1.6. Buku besar `stock_movements` (append-only) dan penghitung nomor dokumen `doc_counters`

**3.2. Migrasi dan constraint**

- 3.2.1. Migrasi awal (`init`)
- 3.2.2. Migrasi constraint database (satu gudang utama: indeks unik parsial pada `is_main`, dst.)
- 3.2.3. Migrasi penggantian nama role (`rename_roles`, `rename_admin_gudang`)

**3.3. Koneksi dan data awal**

- 3.3.1. Prisma client singleton dengan adapter `pg` dan zona waktu sesi UTC
- 3.3.2. Seed idempotent: 3 cabang, 5 akun, 3 kategori, 10 produk, 1 stok masuk contoh lewat service
- 3.3.3. Pembuatan dua database (`softeng_inventaris` dan `softeng_inventaris_test`)

## 4. Autentikasi, Otorisasi, dan Layout (Fase 1)

**4.1. Autentikasi backend**

- 4.1.1. `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- 4.1.2. JWT dalam cookie `httpOnly` dan hashing password (bcrypt)
- 4.1.3. Pemuatan ulang user dari database di setiap request (akun nonaktif langsung 401)

**4.2. Otorisasi (RBAC)**

- 4.2.1. Tiga role: Owner, Admin Gudang, Pegawai Cabang
- 4.2.2. Middleware `authenticate`, `requireRole`, dan `requireAssignedBranch`
- 4.2.3. Scoping cabang untuk Pegawai Cabang (`resolveBranchId`; `branchId` dari klien diabaikan)

**4.3. Frontend**

- 4.3.1. Halaman login
- 4.3.2. Layout sidebar dan header per role (drawer di layar kecil)
- 4.3.3. Penjaga akses `AppShell` dan aturan route per role
- 4.3.4. Halaman 403 dan `/menunggu-penugasan`
- 4.3.5. Penanganan route yang tidak ditemukan di dalam layout

## 5. Data Master (Fase 2)

**5.1. Cabang (Owner)**

- 5.1.1. Daftar, buat, ubah, dan detail cabang (`/cabang`, `/cabang/baru`, `/cabang/[id]`)
- 5.1.2. Aktifkan dan nonaktifkan cabang secara transaksional (efek ke pegawai, request DIAJUKAN, dan opname MENUNGGU)
- 5.1.3. Perlindungan gudang utama (tidak dapat dinonaktifkan) dan pemblokiran bila ada transfer DISETUJUI/DIKIRIM

**5.2. User (Owner)**

- 5.2.1. Daftar, buat, ubah, dan detail user (`/users`, `/users/baru`, `/users/[id]`)
- 5.2.2. Aktifkan dan nonaktifkan user; penugasan cabang untuk Pegawai Cabang
- 5.2.3. Aturan keamanan akun: minimal satu Owner aktif, tidak menonaktifkan akun sendiri, tidak mengubah role akun sendiri

**5.3. Kategori (Owner, Admin Gudang)**

- 5.3.1. CRUD kategori dengan dialog (`/kategori`)

**5.4. Produk (Owner, Admin Gudang)**

- 5.4.1. Daftar, buat, ubah, dan detail produk (`/produk`, `/produk/baru`, `/produk/[id]`)
- 5.4.2. Aktifkan dan nonaktifkan produk
- 5.4.3. Hapus produk hanya bila belum pernah punya pergerakan atau dokumen
- 5.4.4. Kartu "Stok per cabang" pada detail produk

**5.5. Komponen bersama**

- 5.5.1. `DataTable` (skeleton, error + coba lagi, empty state, paginasi)
- 5.5.2. `ConfirmDialog`, `FormField`, `PageHeader`, dan lencana status
- 5.5.3. Utilitas paginasi, pencarian, dan filter

## 6. Stok dan Stok Masuk (Fase 3)

**6.1. Inti layanan stok**

- 6.1.1. `stockService.applyMovement` sebagai satu-satunya jalan mengubah stok (422 bila stok menjadi negatif)
- 6.1.2. Generator nomor dokumen `generateDocNo` (`SI`/`TR`/`OP-YYYYMMDD-NNNN`, atomik, zona WIB)
- 6.1.3. Utilitas tanggal zona Asia/Jakarta (`datetime`)

**6.2. Stok masuk (Owner, Admin Gudang)**

- 6.2.1. `GET/POST /stock-ins` dan `GET /stock-ins/:id`
- 6.2.2. Halaman daftar, form multi-item dengan konfirmasi, dan detail (`/stok-masuk`, `/stok-masuk/baru`, `/stok-masuk/[id]`)

**6.3. Tampilan stok**

- 6.3.1. `GET /stocks` dengan filter cabang, pencarian, dan status
- 6.3.2. Halaman `/stok` (Owner, Admin Gudang; pilih cabang) dan `/inventaris` (Pegawai Cabang)
- 6.3.3. Ringkasan stok pada detail cabang

**6.4. Status stok tiga tingkat**

- 6.4.1. Aturan status Aman, Menipis, dan Habis di satu tempat (`stocks/status.ts` dan `statusSql.ts`)
- 6.4.2. Lencana dan warna angka (Habis merah, Menipis kuning) serta filter status

## 7. Transfer Stok (Fase 4)

**7.1. Alur transfer backend**

- 7.1.1. Daftar dan detail transfer (`GET /transfers`, `GET /transfers/:id`)
- 7.1.2. Request cabang: buat, batalkan, setujui (dengan qty disetujui), dan tolak
- 7.1.3. Pengiriman langsung oleh Owner/Admin Gudang (`POST /transfers/direct`)
- 7.1.4. Kirim: pengurangan stok gudang (`TRANSFER_OUT`), pengecekan stok, penolakan utuh 422
- 7.1.5. Terima oleh Pegawai Cabang tujuan (`TRANSFER_IN`), selisih kirim tercatat tanpa menjadi movement
- 7.1.6. Penguncian baris transfer agar aksi ganda atau bersamaan dijawab 409

**7.2. Antarmuka**

- 7.2.1. `/transfer` dengan tab per status dan `/transfer/kirim` (Owner, Admin Gudang)
- 7.2.2. `/request-stok` (Request Saya dan Kiriman Masuk) dan `/request-stok/baru` (Pegawai Cabang)
- 7.2.3. `/transfer/[id]` dengan riwayat proses, tombol aksi per role dan status, serta dialog qty dan alasan

## 8. Stok Opname (Fase 5)

**8.1. Backend**

- 8.1.1. `GET /opnames`, `GET /opnames/:id`, `GET /opnames/prefill`, `POST /opnames`
- 8.1.2. Qty sistem dibaca server saat simpan; hanya satu opname MENUNGGU per cabang (409)
- 8.1.3. Setujui (menerapkan selisih ke stok saat ini lewat `stockService`, tipe `OPNAME`) dan tolak (catatan wajib)
- 8.1.4. Aturan verifikator menurut role pembuat (Pegawai Cabang → Admin Gudang atau Owner; Admin Gudang dan Owner → Owner)

**8.2. Antarmuka**

- 8.2.1. `/opname` (daftar dengan filter), `/opname/baru` (formulir semua produk aktif), `/opname/[id]` (detail dan verifikasi)
- 8.2.2. Lencana status dan pewarnaan selisih

## 9. Riwayat Pergerakan Stok (Fase 6)

**9.1. Backend**

- 9.1.1. `GET /movements` (hanya baca) dengan filter cabang, produk, tipe, dan rentang tanggal WIB
- 9.1.2. Pegawai Cabang dipaksa ke cabangnya; paginasi
- 9.1.3. Perbaikan zona waktu sesi database (UTC) untuk filter tanggal

**9.2. Antarmuka**

- 9.2.1. `/riwayat` dengan label tipe berbahasa Indonesia dan qty bertanda berwarna
- 9.2.2. Tautan ke dokumen sumber (stok masuk, transfer, opname)
- 9.2.3. Tata letak ringkas untuk layar kecil

## 10. Dashboard (Fase 7)

**10.1. Backend**

- 10.1.1. `GET /dashboard` dengan isi sesuai role (Owner/Admin Gudang dengan filter cabang; Pegawai Cabang cabangnya sendiri)
- 10.1.2. Kartu: produk aktif, cabang aktif, Menipis, Habis, request menunggu, transfer siap kirim, opname menunggu
- 10.1.3. Tabel stok bermasalah (maks. 10 baris, paling mendesak dulu) dan 10 pergerakan terbaru
- 10.1.4. Distribusi 30 hari terakhir per cabang tujuan

**10.2. Antarmuka**

- 10.2.1. Kartu statistik (Menipis dan Habis terpisah)
- 10.2.2. Grafik batang distribusi (Recharts) dengan tooltip, tampilan tabel, dan mode gelap
- 10.2.3. Tabel stok menipis, daftar pergerakan terbaru, dan kartu opname terakhir (Pegawai Cabang)
- 10.2.4. Filter cabang (Owner/Admin Gudang)

## 11. Laporan (Fase 8)

**11.1. Laporan Stok**

- 11.1.1. `GET /reports/stock`: stok awal, masuk, transfer masuk, transfer keluar, opname, dan stok akhir per cabang × produk
- 11.1.2. Penandaan Menipis/Habis menurut stok akhir periode
- 11.1.3. Halaman `/laporan/stok`

**11.2. Laporan Distribusi**

- 11.2.1. `GET /reports/distribution`: rekap per cabang tujuan, rincian per produk, dan selisih kirim
- 11.2.2. Request dan pengiriman langsung sebagai baris terpisah
- 11.2.3. Rekap status pengajuan
- 11.2.4. Halaman `/laporan/distribusi` dengan rincian buka/tutup

**11.3. Filter umum**

- 11.3.1. Filter cabang dan periode (bawaan 1 bulan berjalan; batas hari WIB inklusif; validasi)

## 12. Pengujian dan Perapian (Fase 9)

**12.1. Tes integrasi backend**

- 12.1.1. Vitest dan Supertest (`npm test`) pada database tes terpisah yang direset otomatis
- 12.1.2. Pengaman agar database development tidak tersentuh
- 12.1.3. Helper sesi dan fixture
- 12.1.4. 15 skenario uji wajib (alur stok dan transfer, kirim melebihi stok, kirim bersamaan, scoping, opname, nonaktif cabang/gudang/user, hapus produk, constraint database, nomor dokumen)
- 12.1.5. Tes kriteria laporan dan akses (18 tes seluruhnya)

**12.2. Pengujian lain**

- 12.2.1. Skrip uji API dan browser sementara per fase (Playwright pada layar desktop, 390px, dan mode gelap; tidak masuk repo)
- 12.2.2. Uji `db:reset` pada database tes

**12.3. Perapian**

- 12.3.1. Peninjauan `npm audit` dan peringatan ESLint (dicatat)
- 12.3.2. Pelengkapan README

## 13. Revisi di Luar Urutan Fase

**13.1. Penggantian nama role (SuperAdmin → Admin Gudang, Pegawai → Pegawai Cabang)**

- 13.1.1. Perubahan enum, API, UI, seed, dan dokumentasi

**13.2. Status stok tiga tingkat dan role akun sendiri**

- 13.2.1. Status Aman/Menipis/Habis menggantikan `isLow`
- 13.2.2. Larangan mengubah role akun sendiri (409 `SELF_ROLE_CHANGE`)

## 14. Belum Dikerjakan (Di Luar Lingkup)

Butir 14.1–14.8 adalah daftar di INSTRUCTION.md bagian 13; 14.9–14.10 adalah usulan lanjutan dari `PROGRESS.md` bagian 5. Semuanya baru dikerjakan bila diminta.

- 14.1. Stok keluar karena penjualan atau pemakaian di cabang
- 14.2. Transfer antar cabang dan retur khusus
- 14.3. Tipe movement untuk barang hilang saat pengiriman
- 14.4. Ekspor laporan (CSV, Excel, PDF)
- 14.5. Notifikasi (email atau real-time)
- 14.6. Tabel supplier terstruktur (saat ini teks bebas)
- 14.7. Audit log umum di luar `stock_movements`
- 14.8. Harga dan nilai stok
- 14.9. Tes browser otomatis di repo
- 14.10. Persiapan produksi (build backend, pengelolaan environment)
