# Sistem Inventaris Multi Cabang

Monorepo (npm workspaces): `backend` (Express 5 + Prisma 7 + PostgreSQL) dan `frontend` (Next.js + Tailwind + shadcn/ui).
Spesifikasi lengkap ada di [`INSTRUCTION.md`](./INSTRUCTION.md).

## Prasyarat

- Node.js 20.19 atau lebih baru (diuji dengan Node 24)
- PostgreSQL 18 yang berjalan di `localhost:5432` (diinstal langsung di Windows, tanpa Docker)
- Dua database kosong: `softeng_inventaris` dan `softeng_inventaris_test`

```sql
CREATE DATABASE softeng_inventaris;
CREATE DATABASE softeng_inventaris_test;
```

## Instalasi

```powershell
npm install
```

npm 11 memblokir install script paket secara default. Paket yang sudah disetujui (`bcrypt`, `prisma`, `@prisma/engines`, `esbuild`) tercatat di `allowScripts` pada `package.json` root.

## Konfigurasi

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env`: ganti `PASSWORD_ANDA` (di `DATABASE_URL` dan `DATABASE_URL_TEST`) dengan password user `postgres`, dan ganti `JWT_SECRET`.

`frontend\.env.local` sudah berisi `BACKEND_URL="http://localhost:4000"` (lihat `frontend\.env.example`).

## Database

Prisma 7 tidak menjalankan `generate` dan seed otomatis, jadi script npm di bawah menjalankannya secara eksplisit.

| Perintah (dari root)                    | Fungsi                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `npm run db:migrate`                    | `prisma migrate dev` lalu `prisma generate`                                 |
| `npm run db:seed`                       | `prisma db seed` (idempotent)                                               |
| `npm run db:generate`                   | `prisma generate` saja                                                      |
| `npm run db:reset`                      | Hapus semua data, migrasi ulang, generate, lalu seed                        |
| `npm run db:deploy --workspace backend` | `prisma migrate deploy` lalu `prisma generate` (tanpa membuat migrasi baru) |

> **Peringatan:** `db:reset` menghapus **semua** data database yang ada di `DATABASE_URL` (stok masuk, transfer, opname, dst.), lalu mengisi ulang dengan seed. Jangan dijalankan bila ada data yang ingin dipertahankan.

Pertama kali:

```powershell
npm run db:migrate
npm run db:seed
```

Akun seed (password dari `SEED_DEFAULT_PASSWORD`, default `password123`):

| Role           | Email                          | Cabang |
| -------------- | ------------------------------ | ------ |
| Owner          | `owner@softeng.local`          | —      |
| Admin Gudang   | `admingudang1@softeng.local`   | —      |
| Admin Gudang   | `admingudang2@softeng.local`   | —      |
| Pegawai Cabang | `pegawaicabang1@softeng.local` | CB01   |
| Pegawai Cabang | `pegawaicabang2@softeng.local` | CB02   |

## Menjalankan

Di dua terminal terpisah:

```powershell
npm run dev:be   # Express di http://localhost:4000
npm run dev:fe   # Next.js di http://localhost:3000
```

Cek koneksi: buka `http://localhost:3000/api/health` (diteruskan oleh Next.js ke Express). Responsnya `{"status":"ok","database":"up",...}` bila database terhubung.

## Perintah lain

```powershell
npm run lint
npm run typecheck
npm run format         # Prettier
npm run format:check
npm test               # tes integrasi backend (lihat bagian Pengujian)
```

## Pengujian

Tes integrasi backend memakai Vitest dan Supertest terhadap database **terpisah** (`DATABASE_URL_TEST`, bawaan `softeng_inventaris_test`):

```powershell
npm test
```

Setiap kali dijalankan, tes mengosongkan database tes, memigrasinya (`prisma migrate deploy`), mengisinya dengan seed, lalu menjalankan skenario. Database development (`DATABASE_URL`) tidak pernah disentuh: proses tes menolak berjalan bila `DATABASE_URL_TEST` kosong, sama dengan `DATABASE_URL`, atau nama databasenya tidak berakhiran `_test`. Karena semua file tes berbagi satu database, file dijalankan berurutan.

Tes mencakup 15 skenario uji wajib (INSTRUCTION.md bagian 12, Fase 9) di `backend/tests/stock-flow.test.ts`, `lifecycle.test.ts`, dan `doc-numbers.test.ts`, serta kriteria laporan dan akses di `reports.test.ts`. Tes browser (UI) tidak termasuk di repo.

## Fitur per halaman

| Area               | Halaman (role)                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Dashboard          | `/dashboard` (semua role; isi berbeda untuk Owner/Admin Gudang dan Pegawai Cabang)                               |
| Data master        | `/produk`, `/kategori` (Owner, Admin Gudang); `/cabang`, `/users` (Owner)                                        |
| Stok               | `/stok` (Owner, Admin Gudang); `/inventaris` (Pegawai Cabang); `/stok-masuk` (Owner, Admin Gudang)               |
| Transfer           | `/transfer`, `/transfer/kirim` (Owner, Admin Gudang); `/request-stok` (Pegawai Cabang); `/transfer/[id]` (semua) |
| Opname dan riwayat | `/opname`, `/riwayat` (semua role; Pegawai Cabang hanya cabangnya)                                               |
| Laporan            | `/laporan/stok`, `/laporan/distribusi` (Owner, Admin Gudang)                                                     |

Daftar endpoint ada di INSTRUCTION.md bagian 7; keputusan implementasi per fase ada di bagian 14. Status pengerjaan, keputusan, dan masalah yang belum selesai dicatat di [`PROGRESS.md`](./PROGRESS.md).

## Catatan dependensi

`npm audit` melaporkan kerentanan tingkat low/moderate, seluruhnya pada alat pengembangan (`typescript-eslint` → `minimatch`, dan CLI `shadcn` → `deepmerge`/`ts-morph`), bukan pada kode yang berjalan di server. Perbaikannya memerlukan perubahan versi mayor (`npm audit fix --force`), sehingga belum diterapkan. `npm install` juga mencetak peringatan bahwa ESLint 9 tidak lagi didukung; belum ditingkatkan.

## Autentikasi (Fase 1)

- Login memakai cookie JWT `httpOnly` (nama `token`). Frontend memanggil `/api/*` yang di-proxy Next.js ke Express, jadi cookie bersifat same-origin.
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Middleware `authenticate` memuat ulang user dari database di setiap request, sehingga akun yang dinonaktifkan langsung mendapat 401.
- Pegawai Cabang tanpa cabang hanya bisa memakai `/api/auth/*` (endpoint lain 403) dan di frontend diarahkan ke `/menunggu-penugasan`.
