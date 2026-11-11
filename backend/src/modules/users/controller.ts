import type { RequestHandler } from "express";
import { currentUser, validatedParams, validatedQuery } from "../../utils/http";
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from "./schema";
import * as service from "./service";

type IdParams = { id: number };

export const list: RequestHandler = async (req, res) => {
  res.json(await service.listUsers(validatedQuery<ListUsersQuery>(req)));
};

export const get: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.getUser(id) });
};

export const create: RequestHandler = async (req, res) => {
  const data = await service.createUser(req.body as CreateUserInput);
  res.status(201).json({ data });
};

export const update: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.updateUser(id, req.body as UpdateUserInput) });
};

export const deactivate: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.deactivateUser(id, currentUser(req).id) });
};

export const activate: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.activateUser(id) });
};
