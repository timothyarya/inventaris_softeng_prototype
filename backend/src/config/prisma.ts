import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// Sesi database dipaksa ke UTC. Prisma mengirim parameter waktu sebagai UTC tanpa zona; bila zona
// sesi server PostgreSQL bukan UTC (mis. Asia/Bangkok), filter tanggal bergeser beberapa jam.
// Batas hari WIB dihitung di aplikasi (utils/datetime), bukan oleh zona sesi database.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  options: "-c timezone=UTC",
});

// Satu instance saja (singleton) untuk seluruh aplikasi.
export const prisma = new PrismaClient({ adapter });
