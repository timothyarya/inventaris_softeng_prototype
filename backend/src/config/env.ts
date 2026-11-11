import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  DATABASE_URL_TEST: z.string().optional(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET wajib diisi"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  PORT: z.coerce.number().int().positive().default(4000),
  SEED_DEFAULT_PASSWORD: z.string().min(1).default("password123"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Konfigurasi .env tidak valid:\n${detail}`);
}

export const env = parsed.data;
