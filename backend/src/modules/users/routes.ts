import { Router } from "express";
import { requireRole } from "../../middlewares/requireRole";
import { validate } from "../../middlewares/validate";
import { idParamSchema } from "../../utils/http";
import * as controller from "./controller";
import { createUserSchema, listUsersQuerySchema, updateUserSchema } from "./schema";

export const usersRouter = Router();

const idParam = validate(idParamSchema, "params");

// Bagian 4.2: hanya Owner yang mengelola user.
usersRouter.use(requireRole("OWNER"));

usersRouter.get("/", validate(listUsersQuerySchema, "query"), controller.list);
usersRouter.get("/:id", idParam, controller.get);
usersRouter.post("/", validate(createUserSchema), controller.create);
usersRouter.patch("/:id", idParam, validate(updateUserSchema), controller.update);
usersRouter.patch("/:id/deactivate", idParam, controller.deactivate);
usersRouter.patch("/:id/activate", idParam, controller.activate);
