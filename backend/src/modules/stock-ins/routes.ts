import { Router } from "express";
import { requireRole } from "../../middlewares/requireRole";
import { validate } from "../../middlewares/validate";
import { idParamSchema } from "../../utils/http";
import * as controller from "./controller";
import { createStockInSchema, listStockInsQuerySchema } from "./schema";

export const stockInsRouter = Router();

// Bagian 7: stok masuk hanya untuk Owner dan Admin Gudang. Tidak ada edit/hapus (bagian 4.4).
stockInsRouter.use(requireRole("OWNER", "ADMIN_GUDANG"));

stockInsRouter.get("/", validate(listStockInsQuerySchema, "query"), controller.list);
stockInsRouter.get("/:id", validate(idParamSchema, "params"), controller.get);
stockInsRouter.post("/", validate(createStockInSchema), controller.create);
