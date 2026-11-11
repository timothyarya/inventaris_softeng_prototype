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

| Perintah (dari root)  | Fungsi                                               |
| --------------------- | ---------------------------------------------------- |
| `npm run db:migrate`  | `prisma migrate dev` lalu `prisma generate`          |
| `npm run db:seed`     | `prisma db seed` (idempotent)                        |
| `npm run db:generate` | `prisma generate` saja                               |
| `npm run db:reset`    | Hapus semua data, migrasi ulang, generate, lalu seed |

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
```

## Autentikasi (Fase 1)

- Login memakai cookie JWT `httpOnly` (nama `token`). Frontend memanggil `/api/*` yang di-proxy Next.js ke Express, jadi cookie bersifat same-origin.
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Middleware `authenticate` memuat ulang user dari database di setiap request, sehingga akun yang dinonaktifkan langsung mendapat 401.
- Pegawai Cabang tanpa cabang hanya bisa memakai `/api/auth/*` (endpoint lain 403) dan di frontend diarahkan ke `/menunggu-penugasan`.
