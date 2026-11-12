import { Router } from "express";
import { validate } from "../../middlewares/validate";
import * as controller from "./controller";
import { dashboardQuerySchema } from "./schema";

export const dashboardRouter = Router();

// Bagian 7: semua role; isi dan cakupan cabang ditentukan di service.
dashboardRouter.get("/", validate(dashboardQuerySchema, "query"), controller.get);
