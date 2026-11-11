import { Router } from "express";
import { requireRole } from "../../middlewares/requireRole";
import { validate } from "../../middlewares/validate";
import { idParamSchema } from "../../utils/http";
import * as controller from "./controller";
import { createProductSchema, listProductsQuerySchema, updateProductSchema } from "./schema";

export const productsRouter = Router();

const adminOnly = requireRole("OWNER", "ADMIN_CABANG");
const idParam = validate(idParamSchema, "params");

// Semua role boleh melihat daftar (Pegawai Cabang: hanya produk aktif, dipaksa di service).
productsRouter.get("/", validate(listProductsQuerySchema, "query"), controller.list);

// GET /products/:id dipakai halaman edit produk (Owner/Admin Cabang).
productsRouter.get("/:id", adminOnly, idParam, controller.get);
productsRouter.post("/", adminOnly, validate(createProductSchema), controller.create);
productsRouter.patch("/:id", adminOnly, idParam, validate(updateProductSchema), controller.update);
productsRouter.patch("/:id/deactivate", adminOnly, idParam, controller.deactivate);
productsRouter.patch("/:id/activate", adminOnly, idParam, controller.activate);
productsRouter.delete("/:id", adminOnly, idParam, controller.remove);
