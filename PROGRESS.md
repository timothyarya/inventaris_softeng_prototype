# PROGRESS.md — Sistem Inventaris Multi Cabang

Catatan status pengerjaan. Spesifikasi lengkap ada di [`INSTRUCTION.md`](./INSTRUCTION.md); keputusan tambahan ada di bagian 14 file itu.

_Terakhir diperbarui: 2026-11-11._

## 1. Status fase

| Fase | Isi                                          | Status      | Commit             |
| ---- | -------------------------------------------- | ----------- | ------------------ |
| 0    | Setup monorepo, Prisma 7, migrasi, seed      | **Selesai** | `039f2ea`          |
| 1    | Auth, RBAC, layout per role                  | **Selesai** | `dd11755`          |
| 2    | Data master (cabang, user, kategori, produk) | **Selesai** | commit "Fase 2: …" |
| 3–9  | Stock service & stok masuk → pengujian       | Belum       | —                  |

### Yang sudah ada

- **Fase 0:** npm workspaces (`backend`, `frontend`), Express 5 (ESM) + Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 18, dua migrasi (`init` dan `db_constraints` sesuai bagian 6.1), seed (3 cabang, 4 user, 3 kategori, 10 produk), `/api/health` (dengan `SELECT 1`), Next.js 16 + Tailwind 4 + shadcn/ui, proxy `/api/*` ke Express, ESLint dan Prettier.
- **Fase 1:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; middleware `authenticate` (memuat ulang user dari DB di setiap request), `requireRole`, `requireAssignedBranch`, `validate`, helper scoping `resolveBranchId`; frontend: halaman login, layout sidebar + header per role (drawer di mobile), halaman 403, `/menunggu-penugasan`, penjaga akses `AppShell`, dashboard placeholder.
- **Fase 2:** modul backend `branches`, `users`, `categories`, `products` (CRUD, aktif/nonaktif, paginasi, pencarian, filter; nonaktif cabang transaksional dengan efek ke pegawai, transfer DIAJUKAN, dan opname MENUNGGU); utilitas `pagination`, `http`, `password`; frontend `/cabang`, `/cabang/baru`, `/cabang/[id]`, `/users`, `/users/baru`, `/users/[id]`, `/kategori` (dialog), `/produk`, `/produk/baru`, `/produk/[id]` dengan komponen bersama `DataTable`, `ConfirmDialog`, `FormField`, `PageHeader`; hook TanStack Query per modul. Kartu "Stok per cabang" di `/produk/[id]` baru placeholder (datanya dari Fase 3).

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
2. **Skrip uji tidak masuk repo.** Pengujian Fase 1 (46 cek HTTP, 14 cek `requireRole`/scoping, 62 cek browser) dan Fase 2 (153 cek API, 56 cek browser) dijalankan lewat skrip sementara di folder scratchpad dan tidak di-commit. Tes otomatis di repo baru dibuat di Fase 9 (Vitest + Supertest).
3. **Database tes belum dipakai.** `softeng_inventaris_test` sudah dibuat tetapi belum dimigrasi. Ingat: URL migrasi Prisma 7 dibaca dari `prisma.config.ts`, jadi untuk tes perlu `DATABASE_URL` yang di-set lewat `cross-env` (lihat Fase 9).
4. **`npm audit`** melaporkan beberapa kerentanan tingkat moderate (7 saat Fase 0) dan ESLint 9.39.5 memberi peringatan "no longer supported". Belum ditinjau.
5. **Keterbatasan yang disengaja (spec tidak memintanya):**
   - Logout tidak mencabut token JWT; token tetap valid sampai kedaluwarsa. Akun nonaktif tetap ditolak lewat pemuatan ulang user.
   - Tidak ada pembatasan percobaan login.
6. **Sebagian halaman di sidebar belum ada.** Produk, Kategori, Cabang, dan User sudah ada (Fase 2). Stok Cabang, Inventaris, Stok Masuk, Transfer, Request Stok, Opname, Riwayat, dan Laporan masih menampilkan "Halaman tidak ditemukan" di dalam layout sampai fasenya dikerjakan.
7. **Folder kosong dari struktur spec** (`modules/*` selain `auth`, `services/`) belum ada di git. Dibuat saat dipakai.
8. **Kartu "Stok per cabang" di `/produk/[id]`** dan "Ringkasan stok" di `/cabang/[id]` belum berisi data nyata (stok baru ada setelah Fase 3); ringkasan cabang menampilkan semua produk aktif sebagai "stok menipis" jika `min_stock > 0` karena belum ada stok.
9. **Fase 2 tidak menguji penolakan cabang saat ada transfer DISETUJUI/DIKIRIM lewat UI**; skenarionya diuji di level API dengan data yang disisipkan lewat psql (lalu dibersihkan). Pengujian lewat UI menunggu fitur transfer (Fase 4).

## 5. Langkah berikutnya: Fase 3 — Stock Service & Stok Masuk

Cakupan (INSTRUCTION.md bagian 12, 4.4, 4.7, 4.10, dan prinsip teknis bagian 5):

- `stockService.applyMovement` sebagai satu-satunya jalan mengubah `branch_stocks` (dalam transaksi, kunci baris `FOR UPDATE`, `qty >= 0`, upsert baris, movement dengan `qty_before`/`qty_after`).
- Generator nomor dokumen (4.10).
- Stok Masuk (`/stok-masuk`, Owner dan SuperAdmin): menambah stok gudang utama dan membuat movement.
- Halaman `/stok` (Owner/SuperAdmin) dan `/inventaris` (Pegawai), serta kartu "Stok per cabang" di `/produk/[id]` dan ringkasan stok di `/cabang/[id]` yang kini masih placeholder/kosong.
- Seed stok masuk contoh lewat `stockService` (disepakati di Fase 0).

**Kriteria selesai:** stok masuk menambah stok gudang dan membuat movement; saldo konsisten.

**Yang perlu ditanyakan sebelum mulai** jika spec 4.4 dan 4.10 belum cukup tegas (mis. format nomor dokumen, apakah stok masuk boleh dibatalkan, batas qty per item).
