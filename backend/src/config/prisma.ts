import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Satu instance saja (singleton) untuk seluruh aplikasi.
export const prisma = new PrismaClient({ adapter });
