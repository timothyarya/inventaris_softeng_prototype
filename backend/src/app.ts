import cookieParser from "cookie-parser";
import express from "express";
import { prisma } from "./config/prisma";
import { authenticate, requireAssignedBranch } from "./middlewares/auth";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { authRouter } from "./modules/auth/routes";
import { branchesRouter } from "./modules/branches/routes";
import { categoriesRouter } from "./modules/categories/routes";
import { productsRouter } from "./modules/products/routes";
import { stockInsRouter } from "./modules/stock-ins/routes";
import { stocksRouter } from "./modules/stocks/routes";
import { transfersRouter } from "./modules/transfers/routes";
import { usersRouter } from "./modules/users/routes";

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

app.use("/api/branches", branchesRouter);
app.use("/api/users", usersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/stocks", stocksRouter);
app.use("/api/stock-ins", stockInsRouter);
app.use("/api/transfers", transfersRouter);

app.use(notFoundHandler);
app.use(errorHandler);
