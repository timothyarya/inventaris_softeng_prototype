import type { RequestHandler } from "express";
import { currentUser, validatedQuery } from "../../utils/http";
import type { DashboardQuery } from "./schema";
import * as service from "./service";

export const get: RequestHandler = async (req, res) => {
  res.json({
    data: await service.getDashboard(validatedQuery<DashboardQuery>(req), currentUser(req)),
  });
};
