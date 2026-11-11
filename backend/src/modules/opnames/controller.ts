import type { RequestHandler } from "express";
import { currentUser, validatedParams, validatedQuery } from "../../utils/http";
import type {
  ApproveInput,
  CreateOpnameInput,
  ListOpnamesQuery,
  PrefillQuery,
  RejectInput,
} from "./schema";
import * as service from "./service";

const idOf = (req: Parameters<RequestHandler>[0]) => validatedParams<{ id: number }>(req).id;

export const list: RequestHandler = async (req, res) => {
  res.json(await service.listOpnames(validatedQuery<ListOpnamesQuery>(req), currentUser(req)));
};

export const prefill: RequestHandler = async (req, res) => {
  res.json({ data: await service.prefill(validatedQuery<PrefillQuery>(req), currentUser(req)) });
};

export const get: RequestHandler = async (req, res) => {
  res.json({ data: await service.getOpname(idOf(req), currentUser(req)) });
};

export const create: RequestHandler = async (req, res) => {
  const data = await service.createOpname(req.body as CreateOpnameInput, currentUser(req));
  res.status(201).json({ data });
};

export const approve: RequestHandler = async (req, res) => {
  res.json({
    data: await service.approveOpname(idOf(req), req.body as ApproveInput, currentUser(req)),
  });
};

export const reject: RequestHandler = async (req, res) => {
  res.json({
    data: await service.rejectOpname(idOf(req), req.body as RejectInput, currentUser(req)),
  });
};
