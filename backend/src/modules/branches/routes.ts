import { Router } from "express";
import { requireRole } from "../../middlewares/requireRole";
import { validate } from "../../middlewares/validate";
import { idParamSchema } from "../../utils/http";
import * as controller from "./controller";
import { createBranchSchema, listBranchesQuerySchema, updateBranchSchema } from "./schema";

export const branchesRouter = Router();

const owner = requireRole("OWNER");
const idParam = validate(idParamSchema, "params");

// Bagian 7: daftar boleh dilihat Owner dan Admin Gudang; selebihnya hanya Owner.
branchesRouter.get(
  "/",
  requireRole("OWNER", "ADMIN_GUDANG"),
  validate(listBranchesQuerySchema, "query"),
  controller.list,
);
// GET /branches/:id dipakai halaman detail cabang (route /cabang/[id] khusus Owner).
branchesRouter.get("/:id", owner, idParam, controller.get);
branchesRouter.post("/", owner, validate(createBranchSchema), controller.create);
branchesRouter.patch("/:id", owner, idParam, validate(updateBranchSchema), controller.update);
branchesRouter.patch("/:id/deactivate", owner, idParam, controller.deactivate);
branchesRouter.patch("/:id/activate", owner, idParam, controller.activate);
