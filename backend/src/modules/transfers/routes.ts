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

// Bagian 7. Pegawai dibatasi ke cabang tujuannya di service (selain itu 404).
transfersRouter.get("/", validate(listTransfersQuerySchema, "query"), controller.list);
transfersRouter.get("/:id", idParam, controller.get);

transfersRouter.post(
  "/requests",
  requireRole("PEGAWAI"),
  validate(createRequestSchema),
  controller.createRequest,
);
transfersRouter.post(
  "/direct",
  requireRole("OWNER", "SUPERADMIN"),
  validate(createDirectSchema),
  controller.createDirect,
);

transfersRouter.post("/:id/cancel", requireRole("PEGAWAI"), idParam, controller.cancel);
transfersRouter.post(
  "/:id/approve",
  requireRole("OWNER", "SUPERADMIN"),
  idParam,
  emptyBodyAsObject,
  validate(approveSchema),
  controller.approve,
);
transfersRouter.post(
  "/:id/reject",
  requireRole("OWNER", "SUPERADMIN"),
  idParam,
  validate(rejectSchema),
  controller.reject,
);
transfersRouter.post(
  "/:id/send",
  requireRole("OWNER", "SUPERADMIN"),
  idParam,
  emptyBodyAsObject,
  validate(sendSchema),
  controller.send,
);
transfersRouter.post(
  "/:id/receive",
  requireRole("PEGAWAI"),
  idParam,
  emptyBodyAsObject,
  validate(receiveSchema),
  controller.receive,
);
