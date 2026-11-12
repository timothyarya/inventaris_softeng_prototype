import "dotenv/config";
import { defineConfig } from "vitest/config";

// Tes integrasi memakai database terpisah (DATABASE_URL_TEST). `DATABASE_URL` di proses tes
// ditimpa dengan URL tes sehingga aplikasi (Prisma singleton) tidak pernah menyentuh database
// development. Pemeriksaan keamanannya ada di tests/global-setup.ts dan tests/setup.ts.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // Semua file berbagi satu database, jadi dijalankan berurutan.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
    },
  },
});
