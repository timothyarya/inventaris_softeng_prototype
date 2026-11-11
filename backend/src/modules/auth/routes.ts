import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import * as controller from "./controller";
import { loginSchema } from "./schema";

export const authRouter = Router();

// Rute /auth/* tidak memakai requireAssignedBranch: Pegawai Cabang tanpa cabang tetap boleh login & /me.
authRouter.post("/login", validate(loginSchema), controller.login);
authRouter.post("/logout", authenticate, controller.logout);
authRouter.get("/me", authenticate, controller.me);
