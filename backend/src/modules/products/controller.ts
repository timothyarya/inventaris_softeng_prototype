import type { RequestHandler } from "express";
import { currentUser, validatedParams, validatedQuery } from "../../utils/http";
import type { CreateProductInput, ListProductsQuery, UpdateProductInput } from "./schema";
import * as service from "./service";

type IdParams = { id: number };

export const list: RequestHandler = async (req, res) => {
  res.json(await service.listProducts(validatedQuery<ListProductsQuery>(req), currentUser(req)));
};

export const get: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.getProduct(id) });
};

export const create: RequestHandler = async (req, res) => {
  const data = await service.createProduct(req.body as CreateProductInput);
  res.status(201).json({ data });
};

export const update: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.updateProduct(id, req.body as UpdateProductInput) });
};

export const deactivate: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.setProductActive(id, false) });
};

export const activate: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.setProductActive(id, true) });
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  await service.deleteProduct(id);
  res.status(204).end();
};
