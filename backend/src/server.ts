import "dotenv/config";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { app } from "./app";

const server = app.listen(env.PORT, () => {
  console.log(`Backend berjalan di http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} diterima, menutup server...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
