import { Router, type RequestHandler } from "express";
import { requireRole } from "../../middlewares/requireRole";
import { validate } from "../../middlewares/validate";
import { idParamSchema } from "../../utils/http";
import * as controller from "./controller";
import {
  approveSchema,
  createDirectSchema,
  createRequestSchema,
  listTransfersQuerySchema,
  receiveSchema,
  rejectSchema,
  sendSchema,
} from "./schema";

export const transfersRouter = Router();

/** Aksi tanpa isian (mis. setujui dengan qty default) boleh dikirim tanpa body. */
const emptyBodyAsObject: RequestHandler = (req, _res, next) => {
  req.body ??= {};
  next();
};

const idParam = validate(idParamSchema, "params");

// Bagian 7. Pegawai Cabang dibatasi ke cabang tujuannya di service (selain itu 404).
transfersRouter.get("/", validate(listTransfersQuerySchema, "query"), controller.list);
transfersRouter.get("/:id", idParam, controller.get);

transfersRouter.post(
  "/requests",
  requireRole("PEGAWAI_CABANG"),
  validate(createRequestSchema),
  controller.createRequest,
);
transfersRouter.post(
  "/direct",
  requireRole("OWNER", "ADMIN_GUDANG"),
  validate(createDirectSchema),
  controller.createDirect,
);

transfersRouter.post("/:id/cancel", requireRole("PEGAWAI_CABANG"), idParam, controller.cancel);
transfersRouter.post(
  "/:id/approve",
  requireRole("OWNER", "ADMIN_GUDANG"),
  idParam,
  emptyBodyAsObject,
  validate(approveSchema),
  controller.approve,
);
transfersRouter.post(
  "/:id/reject",
  requireRole("OWNER", "ADMIN_GUDANG"),
  idParam,
  validate(rejectSchema),
  controller.reject,
);
transfersRouter.post(
  "/:id/send",
  requireRole("OWNER", "ADMIN_GUDANG"),
  idParam,
  emptyBodyAsObject,
  validate(sendSchema),
  controller.send,
);
transfersRouter.post(
  "/:id/receive",
  requireRole("PEGAWAI_CABANG"),
  idParam,
  emptyBodyAsObject,
  validate(receiveSchema),
  controller.receive,
);
