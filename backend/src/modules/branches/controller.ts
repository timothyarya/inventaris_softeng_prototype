import type { RequestHandler } from "express";
import { currentUser, validatedParams, validatedQuery } from "../../utils/http";
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from "./schema";
import * as service from "./service";

type IdParams = { id: number };

export const list: RequestHandler = async (req, res) => {
  res.json(await service.listBranches(validatedQuery<ListBranchesQuery>(req)));
};

export const get: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.getBranch(id) });
};

export const create: RequestHandler = async (req, res) => {
  const data = await service.createBranch(req.body as CreateBranchInput);
  res.status(201).json({ data });
};

export const update: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.updateBranch(id, req.body as UpdateBranchInput) });
};

export const deactivate: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.deactivateBranch(id, currentUser(req).id) });
};

export const activate: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParams>(req);
  res.json({ data: await service.activateBranch(id) });
};
