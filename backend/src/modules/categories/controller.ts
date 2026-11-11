import type { RequestHandler } from "express";
import { validatedParams, validatedQuery } from "../../utils/http";
import type { CategoryBody, ListCategoriesQuery } from "./schema";
import * as service from "./service";

type IdParams = { id: number };

export const list: RequestHandler = async (req, res) => {
  res.json(await service.listCategories(validatedQuery<ListCategoriesQuery>(req)));
};

export const create: RequestHandler = async (req, res) => {
  const data = await service.createCategory(req.body as CategoryBody);
  res.status(201).json({ data });
};

export const update: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.updateCategory(id, req.body as CategoryBody) });
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  await service.deleteCategory(id);
  res.status(204).end();
};
