import type { RequestHandler } from "express";
import type { ZodType } from "zod";

type Source = "body" | "query" | "params";

/**
 * Validasi input dengan Zod. Kegagalan diteruskan ke errorHandler (400).
 * Hasil parse menggantikan nilai asli. `req.query` di Express 5 hanya-baca,
 * jadi diganti lewat defineProperty.
 */
export const validate =
  (schema: ZodType, source: Source = "body"): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    if (source === "body") {
      req.body = result.data;
    } else {
      Object.defineProperty(req, source, {
        value: result.data,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    }
    next();
  };
