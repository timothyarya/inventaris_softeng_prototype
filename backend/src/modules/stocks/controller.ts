import type { RequestHandler } from "express";
import { currentUser, validatedQuery } from "../../utils/http";
import type { ListStocksQuery } from "./schema";
import * as service from "./service";

export const list: RequestHandler = async (req, res) => {
  res.json(await service.listStocks(validatedQuery<ListStocksQuery>(req), currentUser(req)));
};
