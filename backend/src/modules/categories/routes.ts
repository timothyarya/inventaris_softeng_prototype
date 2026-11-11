import { Router } from "express";
import { requireRole } from "../../middlewares/requireRole";
import { validate } from "../../middlewares/validate";
import { idParamSchema } from "../../utils/http";
import * as controller from "./controller";
import { categoryBodySchema, listCategoriesQuerySchema } from "./schema";

export const categoriesRouter = Router();

// Bagian 7: kategori dikelola Owner dan SuperAdmin.
categoriesRouter.use(requireRole("OWNER", "SUPERADMIN"));

categoriesRouter.get("/", validate(listCategoriesQuerySchema, "query"), controller.list);
categoriesRouter.post("/", validate(categoryBodySchema), controller.create);
categoriesRouter.patch(
  "/:id",
  validate(idParamSchema, "params"),
  validate(categoryBodySchema),
  controller.update,
);
categoriesRouter.delete("/:id", validate(idParamSchema, "params"), controller.remove);
