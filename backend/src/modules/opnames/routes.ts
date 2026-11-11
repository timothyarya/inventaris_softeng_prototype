import { Router, type RequestHandler } from "express";
import { requireRole } from "../../middlewares/requireRole";
import { validate } from "../../middlewares/validate";
import { idParamSchema } from "../../utils/http";
import * as controller from "./controller";
import {
  approveSchema,
  createOpnameSchema,
  listOpnamesQuerySchema,
  prefillQuerySchema,
  rejectSchema,
} from "./schema";

export const opnamesRouter = Router();

/** Setujui boleh dikirim tanpa body (catatan verifikasi opsional). */
const emptyBodyAsObject: RequestHandler = (req, _res, next) => {
  req.body ??= {};
  next();
};

const idParam = validate(idParamSchema, "params");
const verifier = requireRole("OWNER", "ADMIN_GUDANG");

// Bagian 7. Pegawai Cabang dibatasi ke cabangnya di service (selain itu 404).
opnamesRouter.get("/", validate(listOpnamesQuerySchema, "query"), controller.list);
// Harus sebelum "/:id" agar "prefill" tidak dibaca sebagai id.
opnamesRouter.get("/prefill", validate(prefillQuerySchema, "query"), controller.prefill);
opnamesRouter.get("/:id", idParam, controller.get);
opnamesRouter.post("/", validate(createOpnameSchema), controller.create);
// Siapa yang boleh memverifikasi opname tertentu ditentukan di service (menurut role pembuat).
opnamesRouter.post(
  "/:id/approve",
  verifier,
  idParam,
  emptyBodyAsObject,
  validate(approveSchema),
  controller.approve,
);
opnamesRouter.post("/:id/reject", verifier, idParam, validate(rejectSchema), controller.reject);
