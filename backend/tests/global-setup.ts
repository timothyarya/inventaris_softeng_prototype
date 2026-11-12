import "dotenv/config";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const backendDir = fileURLToPath(new URL("..", import.meta.url));

/** Nama database dari URL koneksi (tanpa query string). */
function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

/**
 * Dijalankan sekali sebelum seluruh tes: mengosongkan database tes, memigrasinya (`prisma migrate
 * deploy`), lalu mengisinya dengan seed (cabang, user, produk contoh). Menolak berjalan bila
 * DATABASE_URL_TEST kosong, sama dengan DATABASE_URL, atau namanya tidak berakhiran `_test`,
 * agar database development tidak pernah terhapus.
 */
export default async function setup() {
  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) throw new Error("DATABASE_URL_TEST belum diisi di backend/.env.");
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL_TEST tidak boleh sama dengan DATABASE_URL.");
  }
  const name = databaseName(testUrl);
  if (!name.endsWith("_test")) {
    throw new Error(`Nama database tes harus berakhiran "_test" (sekarang "${name}").`);
  }

  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
  } finally {
    await client.end();
  }

  // prisma.config.ts membaca DATABASE_URL; dotenv tidak menimpa variabel yang sudah ada.
  const env = { ...process.env, DATABASE_URL: testUrl };
  execSync("npx prisma migrate deploy", { cwd: backendDir, env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { cwd: backendDir, env, stdio: "pipe" });
}
