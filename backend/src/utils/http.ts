import type { Request } from "express";
import { z } from "zod";
import type { AuthUser } from "../modules/auth/service";
import { unauthorized } from "./errors";

/** Skema parameter `:id` untuk rute dengan id angka. */
export const idParamSchema = z.object({
  id: z.coerce.number({ error: "ID tidak valid" }).int("ID tidak valid").positive("ID tidak valid"),
});

/** Nilai `req.params` / `req.query` setelah melewati middleware `validate`. */
export const validatedParams = <T>(req: Request) => req.params as unknown as T;
export const validatedQuery = <T>(req: Request) => req.query as unknown as T;

/** User yang sedang login (dijamin ada setelah `authenticate`). */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

/** Teks opsional dari form: string kosong menjadi null, undefined berarti "tidak diubah". */
export const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .nullish()
    .transform((v) => (v === "" ? null : v));
