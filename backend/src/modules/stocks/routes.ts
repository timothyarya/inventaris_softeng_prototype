import { Router } from "express";
import { validate } from "../../middlewares/validate";
import * as controller from "./controller";
import { listStocksQuerySchema } from "./schema";

export const stocksRouter = Router();

// Bagian 7: semua role; Pegawai Cabang dipaksa ke cabangnya di service.
stocksRouter.get("/", validate(listStocksQuerySchema, "query"), controller.list);
