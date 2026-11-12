import { afterAll } from "vitest";
import { prisma } from "../src/config/prisma";

// Pengaman kedua: proses tes harus memakai database tes.
const url = process.env.DATABASE_URL ?? "";
if (!url || url !== process.env.DATABASE_URL_TEST || !new URL(url).pathname.endsWith("_test")) {
  throw new Error("Tes harus memakai DATABASE_URL_TEST (database berakhiran _test).");
}

afterAll(async () => {
  await prisma.$disconnect();
});
