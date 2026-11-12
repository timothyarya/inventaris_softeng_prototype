import type { RequestHandler } from "express";
import { validatedQuery } from "../../utils/http";
import type { ReportQuery } from "./schema";
import * as service from "./service";

export const stock: RequestHandler = async (req, res) => {
  res.json({ data: await service.stockReport(validatedQuery<ReportQuery>(req)) });
};

export const distribution: RequestHandler = async (req, res) => {
  res.json({ data: await service.distributionReport(validatedQuery<ReportQuery>(req)) });
};
