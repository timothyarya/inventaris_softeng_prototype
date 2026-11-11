# PROGRESS.md — Sistem Inventaris Multi Cabang

Catatan status pengerjaan. Spesifikasi lengkap ada di [`INSTRUCTION.md`](./INSTRUCTION.md); keputusan tambahan ada di bagian 14 file itu.

_Terakhir diperbarui: 2026-11-11._

## 1. Status fase

| Fase | Isi                                          | Status      | Commit             |
| ---- | -------------------------------------------- | ----------- | ------------------ |
| 0    | Setup monorepo, Prisma 7, migrasi, seed      | **Selesai** | `039f2ea`          |
| 1    | Auth, RBAC, layout per role                  | **Selesai** | `dd11755`          |
| 2    | Data master (cabang, user, kategori, produk) | **Selesai** | `5dec2ac`          |
| 3    | Stock service & stok masuk                   | **Selesai** | commit "Fase 3: …" |
| 4–9  | Transfer → pengujian                         | Belum       | —                  |

### Yang sudah ada

- **Fase 0:** npm workspaces (`backend`, `frontend`), Express 5 (ESM) + Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 18, dua migrasi (`init` dan `db_constraints` sesuai bagian 6.1), seed (3 cabang, 4 user, 3 kategori, 10 produk), `/api/health` (dengan `SELECT 1`), Next.js 16 + Tailwind 4 + shadcn/ui, proxy `/api/*` ke Express, ESLint dan Prettier.
- **Fase 1:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; middleware `authenticate` (memuat ulang user dari DB di setiap request), `requireRole`, `requireAssignedBranch`, `validate`, helper scoping `resolveBranchId`; frontend: halaman login, layout sidebar + header per role (drawer di mobile), halaman 403, `/menunggu-penugasan`, penjaga akses `AppShell`, dashboard placeholder.
- **Fase 2:** modul backend `branches`, `users`, `categories`, `products` (CRUD, aktif/nonaktif, paginasi, pencarian, filter; nonaktif cabang transaksional dengan efek ke pegawai, transfer DIAJUKAN, dan opname MENUNGGU); utilitas `pagination`, `http`, `password`; frontend `/cabang`, `/cabang/baru`, `/cabang/[id]`, `/users`, `/users/baru`, `/users/[id]`, `/kategori` (dialog), `/produk`, `/produk/baru`, `/produk/[id]` dengan komponen bersama `DataTable`, `ConfirmDialog`, `FormField`, `PageHeader`; hook TanStack Query per modul.
- **Fase 3:** `stockService.applyMovement` (satu-satunya jalan mengubah stok; 422 bila negatif), generator nomor dokumen `generateDocNo` (WIB, atomik), util tanggal WIB, `GET/POST /stock-ins` dan `GET /stock-ins/:id`, `GET /stocks`; seed stok masuk contoh lewat service; frontend `/stok` (Owner/SA, pilih cabang), `/inventaris` (Pegawai), `/stok-masuk`, `/stok-masuk/baru` (form multi-item + konfirmasi), `/stok-masuk/[id]`, kartu "Stok per cabang" di `/produk/[id]`, dan ringkasan stok di `/cabang/[id]` yang kini berisi data.

## 2. Cara menjalankan

Prasyarat: Node.js 20.19+ (diuji di Node 24), PostgreSQL 18 berjalan di `localhost:5432`, dan dua database kosong `softeng_inventaris` dan `softeng_inventaris_test`.

```powershell
cd "D:\2 MyRepos\softengclaude"
npm install

# sekali saja: buat backend\.env dari contoh, lalu isi password PostgreSQL dan JWT_SECRET
Copy-Item backend\.env.example backend\.env
notepad backend\.env

npm run db:migrate     # prisma migrate dev + prisma generate
npm run db:seed        # idempotent

npm run dev:be         # terminal 1: Express di http://localhost:4000
npm run dev:fe         # terminal 2: Next.js di http://localhost:3000
```

- `frontend\.env.local` berisi `BACKEND_URL="http://localhost:4000"` (tidak di-commit; contoh ada di `frontend\.env.example`).
- Cek koneksi: `http://localhost:3000/api/health`.
- Akun seed (password `SEED_DEFAULT_PASSWORD`, default `password123`): `owner@softeng.local`, `superadmin@softeng.local`, `pegawai1@softeng.local` (CB01), `pegawai2@softeng.local` (CB02).
- Pemeriksaan kualitas: `npm run lint`, `npm run typecheck`, `npm run format:check`.
- Seed sekarang juga membuat 1 stok masuk contoh (`npm run db:seed`, idempotent: dilewati jika sudah ada stok masuk).
- Prisma 7 tidak menjalankan `generate` dan seed otomatis. Gunakan script npm di atas, bukan perintah `prisma` mentah, agar langkahnya lengkap.

## 3. Keputusan dan penyimpangan dari INSTRUCTION.md

### Versi paket

- **TypeScript 6.0.3, bukan 7.0.2.** TypeScript 7 tidak punya JS API sehingga tidak kompatibel dengan `typescript-eslint` (dan `eslint-config-next`). Dipilih oleh pemilik proyek. Bisa dinaikkan setelah `typescript-eslint` mendukung.
- **Prisma 7.10.1, bukan tag `latest` (8.0.0-rc.33).** Tag `latest` adalah RC, sedangkan kebijakan versi hanya mengizinkan stabil.
- **ESLint 9, bukan 10.** Mengikuti template Next.js 16.
- **`@types/node` 24, bukan 26.** Disesuaikan dengan runtime Node 24.
- Versi lain: Next.js 16.4.6, React 19.3.1, Express 5.3.0, Tailwind 4.3.5, Zod 4.6.7.

### Perubahan pada INSTRUCTION.md

- Kolom `qty_approved` ditambahkan di `stock_transfer_items`, beserta constraint `qty_approved IS NULL OR qty_approved >= 0` (mengikuti pola kolom qty lain, tidak diminta eksplisit).
- Bagian 14 "Keputusan Tambahan" berisi semua keputusan pemilik proyek (alur approve vs kirim, opname otomatis ditolak saat cabang dinonaktifkan, perubahan role user, definisi stok menipis, dan lainnya) ditambah subbagian "Implementasi Fase 1".

### Keputusan implementasi Fase 1 (di luar spec, sudah dicatat di bagian 14)

- Respons objek tunggal memakai `{ data: ... }`; logout 204.
- Cookie JWT bernama `token` (`httpOnly`, `SameSite=Lax`, `Secure` hanya di production).
- Login gagal selalu 401 dengan pesan sama. Akun nonaktif baru diberi tahu setelah password benar.
- Rute data tak dikenal: 401 tanpa login, 404 dengan login.
- Frontend: route yang belum dibuat ditangkap `(app)/[...slug]` agar penjaga role tetap berlaku (role tidak berhak melihat 403).

### Keputusan implementasi Fase 2 (lengkapnya di bagian 14 INSTRUCTION.md)

- Password minimal 8 dan maksimal 72 karakter.
- `GET /branches` mengembalikan semua cabang; filter `?active=`.
- Kode cabang: huruf besar dan angka 2–20 karakter, tidak bisa diubah. Di UI kode selalu disertai nama (`CB01 — Cabang 01`).
- Tiga endpoint detail di luar tabel API spec: `GET /branches/:id`, `GET /users/:id`, `GET /products/:id`.
- Hapus produk juga ditolak jika sudah tercantum di dokumen transfer/opname.
- Aksi di halaman detail memakai `mutateAsync`: setelah simpan, data dimuat ulang dan tampilan di-remount lewat `key`, sehingga callback `mutate()` tidak dijamin terpanggil (sempat membuat toast hilang dan navigasi setelah hapus produk tidak terjadi).

### Keputusan implementasi Fase 3 (lengkapnya di bagian 14 INSTRUCTION.md)

- Stok masuk: tanggal default hari ini (WIB), boleh mundur, tidak boleh masa depan; produk ganda dalam satu dokumen ditolak; qty 1–1.000.000 per item; maksimal 200 baris. Nomor dokumen memakai tanggal pembuatan (hari ini, WIB).
- `/stok` per cabang yang dipilih, default gudang utama; `GET /stocks` tanpa `branchId` mengembalikan semua cabang aktif.
- Seed menyisakan produk di bawah stok minimum dan tanpa stok agar penanda "Menipis" bisa dicoba.

### Hal teknis lain

- **Seed Fase 0 tanpa stok masuk contoh.** Stok masuk contoh baru ditambahkan di Fase 3 lewat `stockService` (disepakati).
- **npm 11 memblokir install script paket.** Empat paket disetujui di `allowScripts` pada `package.json` root: `bcrypt`, `prisma`, `@prisma/engines`, `esbuild`.
- **Default template Next.js 16.4 dipertahankan:** `cacheComponents: true` dan `partialPrefetching: true`. Ini sempat memaksa penambahan `Suspense` di `(app)/layout.tsx`. Perlu diperhatikan saat membuat halaman dinamis.
- **shadcn/ui memakai style `base-nova` (Base UI), bukan Radix.** Komponen memakai prop `render`, bukan `asChild`.
- **`frontend/src/hooks/use-mobile.ts` bawaan shadcn diubah** ke `useSyncExternalStore` karena melanggar aturan lint React. `button.tsx` hanya berubah format.
- **`globals.css`:** `--font-sans` diarahkan ke `--font-geist-sans` (bawaan shadcn melingkar sehingga font jatuh ke serif).
- **`frontend/.gitignore`** diberi `!.env.example` agar contoh env ikut ter-commit.
- **Backend dijalankan dengan `tsx`** (tanpa langkah build), karena tsconfig memakai `moduleResolution: Bundler` sesuai pola Prisma 7. Backend belum punya script `build`.
- Repo git memakai branch `main`. Git mengeluarkan peringatan LF→CRLF di Windows; tidak berpengaruh.

## 4. Masalah yang belum selesai

1. **`npm run db:reset` belum teruji.** Prisma memblokir `migrate reset` dari agen AI tanpa persetujuan eksplisit pemilik proyek. Script sudah diperbaiki (`prisma migrate reset --force && prisma generate && prisma db seed`), tetapi perlu dijalankan sendiri sekali. Perintah itu menghapus semua data database development.
2. **Skrip uji tidak masuk repo.** Pengujian Fase 1 (46 cek HTTP, 14 cek `requireRole`/scoping, 62 cek browser) Fase 2 (153 cek API, 56 cek browser), dan Fase 3 (82 cek API, 21 cek langsung ke `stockService`/`generateDocNo`, 50 cek browser) dijalankan lewat skrip sementara di folder scratchpad dan tidak di-commit. Tes otomatis di repo baru dibuat di Fase 9 (Vitest + Supertest).
3. **Database tes belum dipakai.** `softeng_inventaris_test` sudah dibuat tetapi belum dimigrasi. Ingat: URL migrasi Prisma 7 dibaca dari `prisma.config.ts`, jadi untuk tes perlu `DATABASE_URL` yang di-set lewat `cross-env` (lihat Fase 9).
4. **`npm audit`** melaporkan beberapa kerentanan tingkat moderate (7 saat Fase 0) dan ESLint 9.39.5 memberi peringatan "no longer supported". Belum ditinjau.
5. **Keterbatasan yang disengaja (spec tidak memintanya):**
   - Logout tidak mencabut token JWT; token tetap valid sampai kedaluwarsa. Akun nonaktif tetap ditolak lewat pemuatan ulang user.
   - Tidak ada pembatasan percobaan login.
6. **Sebagian halaman di sidebar belum ada.** Produk, Kategori, Cabang, User (Fase 2), Stok Cabang, Inventaris, dan Stok Masuk (Fase 3) sudah ada. Transfer, Request Stok, Opname, Riwayat, dan Laporan masih menampilkan "Halaman tidak ditemukan" di dalam layout sampai fasenya dikerjakan.
7. **Folder kosong dari struktur spec** (`modules/*` selain `auth`, `services/`) belum ada di git. Dibuat saat dipakai.
8. **Ringkasan stok cabang kosong di cabang baru:** cabang tanpa stok menampilkan semua produk aktif ber-`min_stock > 0` sebagai "stok menipis" (qty 0 < min), sesuai definisi yang disepakati. Wajar sampai ada transfer (Fase 4).
9. **Fase 2 tidak menguji penolakan cabang saat ada transfer DISETUJUI/DIKIRIM lewat UI**; skenarionya diuji di level API dengan data yang disisipkan lewat psql (lalu dibersihkan). Pengujian lewat UI menunggu fitur transfer (Fase 4).

## 5. Langkah berikutnya: Fase 4 — Transfer Stok

Cakupan (INSTRUCTION.md bagian 12, aturan 4.5, API bagian 7, sitemap bagian 9):

**Backend** (modul `transfers`):

- Request pegawai (`POST /transfers/requests`, DIAJUKAN), pengiriman langsung Owner/SA (`POST /transfers/direct`, langsung DIKIRIM), batalkan (pegawai), setujui (boleh menyesuaikan `qty_approved`), tolak (alasan wajib), kirim, terima.
- Hanya gudang utama → cabang aktif non-gudang. Transisi tidak valid 409; status dibaca ulang di dalam transaksi.
- **Kirim:** cek stok gudang dengan row lock, kurangi lewat `stockService` (`TRANSFER_OUT`, negatif); 422 bila kurang. **Terima:** tambah stok cabang tujuan sebesar `qty_diterima` (`TRANSFER_IN`); selisih tidak menjadi movement. Item dengan qty 0 tidak membuat movement.
- Nomor dokumen `TR` (sudah ada generatornya). Pegawai yang mengakses transfer cabang lain mendapat 404.
- `GET /transfers` (filter status, cabang, tanggal) dan `GET /transfers/:id`.

**Frontend:** `/transfer` (tab per status), `/transfer/kirim`, `/transfer/[id]` (timeline status + tombol aksi sesuai role dan status), `/request-stok` (tab Request Saya dan Kiriman Masuk), `/request-stok/baru`.

**Kriteria selesai:** semua transisi valid berjalan dan transisi tidak valid ditolak; stok gudang tidak bisa minus. Skenario uji yang terkait: nonaktif cabang dengan transfer DISETUJUI/DIKIRIM (skenario 9) kini bisa diuji lewat UI.

**Yang perlu ditanyakan sebelum mulai** (spec belum tegas): produk ganda dalam satu request/pengiriman, batas qty per item, apakah request boleh memuat produk yang stok gudangnya 0, dan tampilan stok gudang saat mengisi form.
