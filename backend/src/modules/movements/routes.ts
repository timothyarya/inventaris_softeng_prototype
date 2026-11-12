import { Router } from "express";
import { validate } from "../../middlewares/validate";
import * as controller from "./controller";
import { listMovementsQuerySchema } from "./schema";

export const movementsRouter = Router();

// Bagian 7: semua role; Pegawai Cabang dipaksa ke cabangnya di service. Hanya baca (buku besar).
movementsRouter.get("/", validate(listMovementsQuerySchema, "query"), controller.list);
