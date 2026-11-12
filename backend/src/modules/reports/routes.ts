import { Router } from "express";
import { requireRole } from "../../middlewares/requireRole";
import { validate } from "../../middlewares/validate";
import * as controller from "./controller";
import { reportQuerySchema } from "./schema";

export const reportsRouter = Router();

// Bagian 7: hanya Owner dan Admin Gudang. Hanya baca.
reportsRouter.use(requireRole("OWNER", "ADMIN_GUDANG"));
reportsRouter.get("/stock", validate(reportQuerySchema, "query"), controller.stock);
reportsRouter.get("/distribution", validate(reportQuerySchema, "query"), controller.distribution);
