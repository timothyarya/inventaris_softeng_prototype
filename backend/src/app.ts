import cookieParser from "cookie-parser";
import express from "express";
import { prisma } from "./config/prisma";
import { authenticate, requireAssignedBranch } from "./middlewares/auth";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { authRouter } from "./modules/auth/routes";

export const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "up", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);

// Semua rute data didaftarkan di bawah penjaga ini: harus login (user dimuat ulang
// dari DB) dan, untuk Pegawai, sudah punya cabang. Rute per modul dipasang di sini
// dengan requireRole(...) masing-masing (fase berikutnya).
app.use("/api", authenticate, requireAssignedBranch);

app.use(notFoundHandler);
app.use(errorHandler);
