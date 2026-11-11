import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";

type ErrorBody = { error: { code: string; message: string } };

const body = (code: string, message: string): ErrorBody => ({ error: { code, message } });

/** Kode error dari Prisma / driver PostgreSQL (bagian 6.1). */
function readDbErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { code?: unknown; cause?: { code?: unknown; originalCode?: unknown } };
  const candidates = [e.code, e.cause?.originalCode, e.cause?.code];
  return candidates.find((c): c is string => typeof c === "string");
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(body("NOT_FOUND", `Rute ${req.method} ${req.path} tidak ditemukan.`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(body(err.code, err.message));
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
      .join("; ");
    res.status(400).json(body("VALIDATION_ERROR", message));
    return;
  }

  const dbCode = readDbErrorCode(err);
  if (dbCode === "P2002" || dbCode === "23505") {
    res.status(409).json(body("CONFLICT", "Data bertentangan dengan data yang sudah ada."));
    return;
  }
  if (dbCode === "23514") {
    res.status(422).json(body("UNPROCESSABLE", "Data melanggar aturan batasan database."));
    return;
  }

  console.error(err);
  res.status(500).json(body("INTERNAL_ERROR", "Terjadi kesalahan pada server."));
};
