import express from "express";
import { prisma } from "./config/prisma";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

export const app = express();

app.disable("x-powered-by");
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "up", time: new Date().toISOString() });
});

app.use(notFoundHandler);
app.use(errorHandler);
