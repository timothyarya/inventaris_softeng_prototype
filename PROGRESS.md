# PROGRESS.md — Sistem Inventaris Multi Cabang

Catatan status pengerjaan. Spesifikasi lengkap ada di [`INSTRUCTION.md`](./INSTRUCTION.md); keputusan tambahan ada di bagian 14 file itu.

_Terakhir diperbarui: 2026-11-11._

## 1. Status fase

| Fase | Isi                                          | Status      | Commit    |
| ---- | -------------------------------------------- | ----------- | --------- |
| 0    | Setup monorepo, Prisma 7, migrasi, seed      | **Selesai** | `039f2ea` |
| 1    | Auth, RBAC, layout per role                  | **Selesai** | `dd11755` |
| 2    | Data master (cabang, user, kategori, produk) | Belum       | —         |
| 3–9  | Stock service & stok masuk → pengujian       | Belum       | —         |

### Yang sudah ada

- **Fase 0:** npm workspaces (`backend`, `frontend`), Express 5 (ESM) + Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 18, dua migrasi (`init` dan `db_constraints` sesuai bagian 6.1), seed (3 cabang, 4 user, 3 kategori, 10 produk), `/api/health` (dengan `SELECT 1`), Next.js 16 + Tailwind 4 + shadcn/ui, proxy `/api/*` ke Express, ESLint dan Prettier.
- **Fase 1:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; middleware `authenticate` (memuat ulang user dari DB di setiap request), `requireRole`, `requireAssignedBranch`, `validate`, helper scoping `resolveBranchId`; frontend: halaman login, layout sidebar + header per role (drawer di mobile), halaman 403, `/menunggu-penugasan`, penjaga akses `AppShell`, dashboard placeholder.

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
2. **Skrip uji tidak masuk repo.** Pengujian Fase 1 (46 cek HTTP, 14 cek `requireRole`/scoping, 62 cek browser) dijalankan lewat skrip sementara di folder scratchpad dan tidak di-commit. Tes otomatis di repo baru dibuat di Fase 9 (Vitest + Supertest).
3. **Database tes belum dipakai.** `softeng_inventaris_test` sudah dibuat tetapi belum dimigrasi. Ingat: URL migrasi Prisma 7 dibaca dari `prisma.config.ts`, jadi untuk tes perlu `DATABASE_URL` yang di-set lewat `cross-env` (lihat Fase 9).
4. **`npm audit`** melaporkan beberapa kerentanan tingkat moderate (7 saat Fase 0) dan ESLint 9.39.5 memberi peringatan "no longer supported". Belum ditinjau.
5. **Keterbatasan yang disengaja (spec tidak memintanya):**
   - Logout tidak mencabut token JWT; token tetap valid sampai kedaluwarsa. Akun nonaktif tetap ditolak lewat pemuatan ulang user.
   - Tidak ada pembatasan percobaan login.
6. **Halaman di sidebar belum ada.** Semua link menu (Produk, Cabang, dan seterusnya) masih menampilkan "Halaman tidak ditemukan" di dalam layout sampai fasenya dikerjakan.
7. **Folder kosong dari struktur spec** (`modules/*` selain `auth`, `services/`) belum ada di git. Dibuat saat dipakai.

## 5. Langkah berikutnya: Fase 2 — Data Master

Cakupan (INSTRUCTION.md bagian 12 dan aturan 4.1–4.3):

**Backend** (modul `branches`, `users`, `categories`, `products`; masing-masing `routes/controller/service/schema.ts`, dipasang di bawah penjaga `/api` yang sudah ada dengan `requireRole`):

- **Cabang** (Owner): `GET/POST /branches`, `PATCH /branches/:id`, `PATCH /branches/:id/deactivate|activate`.
  - Tepat satu gudang utama dan tidak bisa diubah menjadi non-main.
  - Gudang utama tidak bisa dinonaktifkan.
  - Nonaktif ditolak (409) jika ada transfer `DISETUJUI`/`DIKIRIM` ke cabang itu.
  - Dalam satu transaksi: `is_active = false`, semua pegawai cabang → `branch_id = NULL`, request `DIAJUKAN` → `DIBATALKAN` ("Cabang dinonaktifkan"), opname `MENUNGGU` → `DITOLAK` (`verify_note` "Cabang dinonaktifkan", `verified_by` = user yang menonaktifkan).
  - Cabang nonaktif bisa diaktifkan kembali; pegawai tidak otomatis kembali.
- **User** (Owner): `GET/POST /users`, `PATCH /users/:id` (edit, assign cabang, reset password), `PATCH /users/:id/deactivate|activate`.
  - Pegawai boleh tanpa cabang; Owner/SuperAdmin wajib `branch_id = NULL`.
  - Assign hanya ke cabang aktif dan bukan gudang utama.
  - Owner tidak bisa menonaktifkan diri sendiri; minimal 1 Owner aktif.
  - Ubah role oleh Owner (Owner/SuperAdmin → cabang dikosongkan; Owner aktif terakhir tidak boleh diturunkan).
  - Email disimpan huruf kecil (login memakai email yang dinormalisasi).
- **Kategori** (Owner, SuperAdmin): CRUD; hapus ditolak jika masih dipakai produk.
- **Produk** (Owner, SuperAdmin): CRUD, aktif/nonaktif; hapus hanya jika belum pernah punya movement (409 jika sudah). `GET /products` untuk Pegawai hanya mengembalikan produk aktif.

**Frontend:** `/cabang`, `/cabang/baru`, `/cabang/[id]`, `/users`, `/users/baru`, `/users/[id]`, `/kategori` (dialog), `/produk`, `/produk/baru`, `/produk/[id]` — tabel dengan paginasi/pencarian/filter/empty state, dialog konfirmasi untuk aksi berisiko, toast `error.message`. Daftar stok per cabang di `/produk/[id]` bergantung pada data stok Fase 3, jadi cukup disiapkan tempatnya. Komponen shadcn tambahan yang akan dibutuhkan: table, dialog/alert-dialog, select, badge, combobox, dan sejenisnya.

**Kriteria selesai:** semua aturan 4.1–4.3 berjalan; nonaktif cabang mengosongkan cabang pegawainya (skenario uji 9, 10, 12 sebagian bisa diuji sejak fase ini).

**Hal yang perlu ditanyakan sebelum mulai Fase 2** (spec belum menetapkan): aturan password (panjang minimum) untuk user baru dan reset password; apakah `GET /branches` perlu mengembalikan cabang nonaktif secara default atau hanya lewat `?active=`; format dan keunikan kode cabang (misalnya huruf besar saja).
