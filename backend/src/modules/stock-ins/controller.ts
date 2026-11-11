import type { RequestHandler } from "express";
import { currentUser, validatedParams, validatedQuery } from "../../utils/http";
import type { CreateStockInInput, ListStockInsQuery } from "./schema";
import * as service from "./service";

export const list: RequestHandler = async (req, res) => {
  res.json(await service.listStockIns(validatedQuery<ListStockInsQuery>(req)));
};

export const get: RequestHandler = async (req, res) => {
  const { id } = validatedParams<{ id: number }>(req);
  res.json({ data: await service.getStockIn(id) });
};

export const create: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const data = await service.createStockIn(req.body as CreateStockInInput, user.id);
  res.status(201).json({ data });
};
