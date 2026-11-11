# PROGRESS.md — Sistem Inventaris Multi Cabang

Catatan status pengerjaan. Spesifikasi lengkap ada di [`INSTRUCTION.md`](./INSTRUCTION.md); keputusan tambahan ada di bagian 14 file itu.

_Terakhir diperbarui: 2026-11-12._

## 1. Status fase

| Fase | Isi                                          | Status      | Commit    |
| ---- | -------------------------------------------- | ----------- | --------- |
| 0    | Setup monorepo, Prisma 7, migrasi, seed      | **Selesai** | `039f2ea` |
| 1    | Auth, RBAC, layout per role                  | **Selesai** | `dd11755` |
| 2    | Data master (cabang, user, kategori, produk) | **Selesai** | `5dec2ac` |
| 3    | Stock service & stok masuk                   | **Selesai** | `6056011` |
| 4    | Transfer stok                                | **Selesai** | `9cd6ed1` |
| 5    | Stok opname                                  | **Selesai** | `80e6403` |
| 6–9  | Riwayat → pengujian                          | Belum       | —         |

### Yang sudah ada

- **Fase 0:** npm workspaces (`backend`, `frontend`), Express 5 (ESM) + Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 18, dua migrasi (`init` dan `db_constraints` sesuai bagian 6.1), seed (3 cabang, 4 user, 3 kategori, 10 produk), `/api/health` (dengan `SELECT 1`), Next.js 16 + Tailwind 4 + shadcn/ui, proxy `/api/*` ke Express, ESLint dan Prettier.
- **Fase 1:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; middleware `authenticate` (memuat ulang user dari DB di setiap request), `requireRole`, `requireAssignedBranch`, `validate`, helper scoping `resolveBranchId`; frontend: halaman login, layout sidebar + header per role (drawer di mobile), halaman 403, `/menunggu-penugasan`, penjaga akses `AppShell`, dashboard placeholder.
- **Fase 2:** modul backend `branches`, `users`, `categories`, `products` (CRUD, aktif/nonaktif, paginasi, pencarian, filter; nonaktif cabang transaksional dengan efek ke pegawai, transfer DIAJUKAN, dan opname MENUNGGU); utilitas `pagination`, `http`, `password`; frontend `/cabang`, `/cabang/baru`, `/cabang/[id]`, `/users`, `/users/baru`, `/users/[id]`, `/kategori` (dialog), `/produk`, `/produk/baru`, `/produk/[id]` dengan komponen bersama `DataTable`, `ConfirmDialog`, `FormField`, `PageHeader`; hook TanStack Query per modul.
- **Fase 3:** `stockService.applyMovement` (satu-satunya jalan mengubah stok; 422 bila negatif), generator nomor dokumen `generateDocNo` (WIB, atomik), util tanggal WIB, `GET/POST /stock-ins` dan `GET /stock-ins/:id`, `GET /stocks`; seed stok masuk contoh lewat service; frontend `/stok` (Owner/Admin Gudang, pilih cabang), `/inventaris` (Pegawai Cabang), `/stok-masuk`, `/stok-masuk/baru` (form multi-item + konfirmasi), `/stok-masuk/[id]`, kartu "Stok per cabang" di `/produk/[id]`, dan ringkasan stok di `/cabang/[id]` yang kini berisi data.

- **Fase 4:** modul backend `transfers`: `GET /transfers`, `GET /transfers/:id`, `POST /transfers/requests`, `/direct`, `/:id/cancel|approve|reject|send|receive`; kirim memakai `stockService` (`TRANSFER_OUT`) dengan pengecekan stok gudang dan penolakan utuh 422, terima memakai `TRANSFER_IN`; semua aksi mengunci baris transfer sehingga aksi ganda/bersamaan dijawab 409; frontend `/transfer` (tab per status), `/transfer/kirim`, `/transfer/[id]` (riwayat proses, tombol aksi per role+status, dialog qty/alasan), `/request-stok` (tab Request Saya dan Kiriman Masuk), `/request-stok/baru`.
- **Fase 5:** modul backend `opnames`: `GET /opnames`, `GET /opnames/:id`, `GET /opnames/prefill`, `POST /opnames`, `POST /opnames/:id/approve|reject`; qty sistem dibaca server saat simpan, hanya satu opname MENUNGGU per cabang (409, kunci baris cabang), setujui menerapkan **selisih** ke stok saat ini lewat `stockService` (`OPNAME`) dalam satu transaksi dengan 422 bila stok jadi negatif, tolak wajib catatan; aturan siapa yang boleh memverifikasi menurut role pembuat; frontend `/opname`, `/opname/baru`, `/opname/[id]`.

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
- Akun seed (password `SEED_DEFAULT_PASSWORD`, default `password123`): `owner@softeng.local`, `admingudang1@softeng.local`, `admingudang2@softeng.local`, `pegawaicabang1@softeng.local` (CB01), `pegawaicabang2@softeng.local` (CB02).
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
- Seed menyisakan produk di bawah stok minimum dan tanpa stok agar penanda Menipis dan Habis bisa dicoba.

### Keputusan implementasi Fase 4 (lengkapnya di bagian 14 INSTRUCTION.md)

- Produk ganda dalam satu request/pengiriman ditolak; qty 1–1.000.000 per item, maksimal 200 baris. Request boleh memuat produk yang stok gudangnya 0 (stok baru dicek saat Kirim). Pegawai Cabang tidak melihat stok gudang; form pengiriman langsung Owner/Admin Gudang menampilkannya.
- Setujui mengisi `qty_approved` (bawaan = diminta, boleh disesuaikan/0); form Kirim terisi dari `qty_approved` dan boleh diubah. Setujui dan Kirim butuh minimal satu item > 0. Terima: 0 … `qty_sent`, bawaan = dikirim; selisih tidak menjadi movement.
- Yang menolak dicatat di `approved_by/approved_at` (tidak ada kolom terpisah); membatalkan tidak meminta alasan.
- Kirim yang kekurangan stok ditolak utuh dengan 422 yang menyebut semua item yang kurang; nomor dokumen dan stok tidak berubah.
- Detail transfer memuat `warehouseStock` hanya untuk Owner/Admin Gudang pada status DIAJUKAN/DISETUJUI; `shortfall` bernilai null sebelum diterima.

### Keputusan implementasi Fase 5 (lengkapnya di bagian 14 INSTRUCTION.md)

- Formulir memuat semua produk aktif; hanya baris yang diisi qty fisiknya yang disimpan. Item selisih 0 disimpan; minimal 1 item; produk ganda ditolak; qty fisik 0–1.000.000, maksimal 1.000 item, keterangan maksimal 255 karakter. Tanggal bawaan hari ini (WIB), boleh mundur, tidak boleh masa depan.
- **Aturan persetujuan (dari pemilik proyek):** opname Pegawai Cabang → Admin Gudang atau Owner; opname Admin Gudang (cabang mana pun, termasuk gudang utama) → hanya Owner; opname Owner → hanya Owner (boleh menyetujui sendiri), Admin Gudang tidak boleh. Dua poin terakhir adalah saran saya yang Anda setujui ("pakai saran"). Penolakan memakai aturan yang sama.
- Setujui menerapkan selisih ke stok **saat ini**, bukan menimpa: bila stok berubah antara penghitungan dan persetujuan, hasilnya tetap stok sekarang ± selisih (contoh teruji: dihitung 30 → fisik 20, lalu stok naik ke 45 → disetujui menjadi 35).
- Tidak ada endpoint batal/ubah opname (spec tidak memintanya). Opname salah ditolak lalu dibuat ulang.
- Pesan 422 saat stok jadi negatif menyebut SKU dan nama produk; opname tetap MENUNGGU sehingga verifikator dapat menolaknya.

### Penggantian nama role (setelah Fase 4)

- SuperAdmin → **Admin Gudang**, Pegawai → **Pegawai Cabang** (Owner tetap); hak akses sama. Nilai enum di database dan API ikut diganti (`ADMIN_GUDANG`, `PEGAWAI_CABANG`) lewat migrasi `rename_roles`; setelah `git pull` jalankan `npm run db:deploy --workspace backend` (atau `npm run db:migrate`).
- Akun seed berganti nama dan email (lihat bagian 2); akun di database diubah di tempat. Akun Admin Gudang boleh lebih dari satu; seed menambah `admingudang2@softeng.local` untuk pengujian. Detail di bagian 14 INSTRUCTION.md.

### Revisi setelah Fase 4: status stok dan role akun sendiri

- Status stok kini tiga: **Aman**, **Menipis** (kuning, `0 < qty < stok min.`), **Habis** (merah, qty 0 berapa pun stok minimumnya). `GET /stocks` mengembalikan `status` (bukan `isLow`) dan menerima `?status=`; ringkasan cabang memuat `lowStock` dan `outOfStock`. Dashboard (Fase 7) dan laporan (Fase 8) sebaiknya menampilkan Menipis dan Habis terpisah.
- Role akun sendiri tidak dapat diubah (409 `SELF_ROLE_CHANGE`; di UI tampil sebagai teks). Perlindungan "minimal 1 Owner aktif" sudah ada sebelumnya; aturan ini melengkapinya dan juga berlaku bila ada beberapa Owner. Detail di bagian 14 INSTRUCTION.md.

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
2. **Skrip uji tidak masuk repo.** Pengujian Fase 1 (46 cek HTTP, 14 cek `requireRole`/scoping, 62 cek browser) Fase 2 (153 cek API, 56 cek browser), Fase 3 (82 cek API, 21 cek langsung ke `stockService`/`generateDocNo`, 50 cek browser), dan Fase 4 (142 cek API termasuk konkurensi, 71 cek browser), dan Fase 5 (105 cek API termasuk konkurensi dan matriks persetujuan, 60 cek browser termasuk layar 390px) dijalankan lewat skrip sementara di folder scratchpad dan tidak di-commit. Tes otomatis di repo baru dibuat di Fase 9 (Vitest + Supertest).
3. **Database tes belum dipakai.** `softeng_inventaris_test` sudah dibuat tetapi belum dimigrasi. Ingat: URL migrasi Prisma 7 dibaca dari `prisma.config.ts`, jadi untuk tes perlu `DATABASE_URL` yang di-set lewat `cross-env` (lihat Fase 9).
4. **`npm audit`** melaporkan beberapa kerentanan tingkat moderate (7 saat Fase 0) dan ESLint 9.39.5 memberi peringatan "no longer supported". Belum ditinjau.
5. **Keterbatasan yang disengaja (spec tidak memintanya):**
   - Logout tidak mencabut token JWT; token tetap valid sampai kedaluwarsa. Akun nonaktif tetap ditolak lewat pemuatan ulang user.
   - Tidak ada pembatasan percobaan login.
6. **Sebagian halaman di sidebar belum ada.** Produk, Kategori, Cabang, User (Fase 2), Stok Cabang, Inventaris, Stok Masuk (Fase 3), Transfer, Request Stok (Fase 4), dan Stok Opname (Fase 5) sudah ada. Riwayat dan Laporan masih menampilkan "Halaman tidak ditemukan" di dalam layout sampai fasenya dikerjakan.
7. **Folder kosong dari struktur spec** (`modules/*` selain `auth`, `services/`) belum ada di git. Dibuat saat dipakai.
8. **Cabang baru tanpa stok:** semua produk aktifnya berstatus Habis (qty 0) sampai ada transfer yang diterima. Wajar.
9. **Skenario uji 9 (nonaktif cabang dengan transfer DISETUJUI/DIKIRIM)** kini diuji di Fase 4 lewat transfer sungguhan di level API (ditolak 409; DIAJUKAN otomatis dibatalkan setelah transfer selesai). Belum ada pengujian lewat klik di UI untuk skenario ini.
10. **Data uji dibersihkan manual.** Skrip uji membuat data (transfer, stok masuk, opname, cabang `ZT…`/`ZF…`, produk `UJI-…`) lalu dihapus lewat skrip pembersih; data yang Anda input sendiri (stok masuk dan transfer manual) tidak disentuh. Penghitung nomor dokumen hari pengujian ikut dibersihkan agar nomor dokumen Anda tidak melompat. Di Fase 9 tes memakai database terpisah sehingga tidak perlu lagi.
11. **Cabang yang dinonaktifkan tidak bisa menerima kiriman langsung maupun request**, tetapi transfer yang sudah DISETUJUI/DIKIRIM ke cabang itu memblokir penonaktifan (409) sehingga tidak ada transfer yang menggantung.

## 5. Langkah berikutnya: Fase 6 — Riwayat Pergerakan Stok

Cakupan (INSTRUCTION.md bagian 12, aturan 4.7, API bagian 7, sitemap bagian 9):

**Backend** (modul `movements`): `GET /movements` dari tabel `stock_movements` (append-only) dengan filter cabang (Owner/Admin Gudang saja; Pegawai Cabang selalu cabangnya sendiri), produk, tipe (`MASUK`, `TRANSFER_OUT`, `TRANSFER_IN`, `OPNAME`), rentang tanggal, dan paginasi. Kolom: waktu, cabang, produk, tipe, qty (+/−), saldo setelah, nomor dokumen referensi, user.

**Frontend:** `/riwayat` (menu "Riwayat Stok" sudah ada untuk semua role): tabel dengan filter di atas; nomor dokumen dapat diklik ke detail (`/stok-masuk/[id]`, `/transfer/[id]` atau `/request-stok`-nya untuk Pegawai Cabang, `/opname/[id]`).

**Kriteria selesai:** filter dan paginasi berjalan, pegawai hanya melihat cabangnya.

**Yang perlu ditanyakan sebelum mulai** (spec belum tegas):

1. Tautan nomor dokumen: transfer untuk Pegawai Cabang tidak punya halaman `/transfer/[id]` di menunya (memakai `/request-stok`); apakah tautan cukup ke `/transfer/[id]` (halaman detail sudah bisa dibuka Pegawai Cabang untuk transfer cabangnya) atau perlu dibedakan per role?
2. Urutan bawaan: terbaru dulu (waktu, lalu id)? Apakah perlu pilihan urutan?
3. Filter produk: dropdown semua produk aktif, atau pencarian SKU/nama (produk nonaktif yang punya riwayat tetap harus bisa dipilih)?
4. Rentang tanggal memakai zona WIB dan inklusif (seperti daftar lain); apakah bawaannya kosong (semua) atau mis. 30 hari terakhir?
5. Ukuran halaman bawaan (20 seperti daftar lain) dan apakah perlu ekspor (spec tidak memintanya; saya anggap tidak).
6. Tampilan tipe: label Indonesia (Stok masuk, Transfer keluar, Transfer masuk, Opname) dengan warna qty hijau/merah; sesuai?
