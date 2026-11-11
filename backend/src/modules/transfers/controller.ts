import type { RequestHandler } from "express";
import { currentUser, validatedParams, validatedQuery } from "../../utils/http";
import type {
  ApproveInput,
  CreateDirectInput,
  CreateRequestInput,
  ListTransfersQuery,
  ReceiveInput,
  RejectInput,
  SendInput,
} from "./schema";
import * as service from "./service";

const idOf = (req: Parameters<RequestHandler>[0]) => validatedParams<{ id: number }>(req).id;

export const list: RequestHandler = async (req, res) => {
  res.json(await service.listTransfers(validatedQuery<ListTransfersQuery>(req), currentUser(req)));
};

export const get: RequestHandler = async (req, res) => {
  res.json({ data: await service.getTransfer(idOf(req), currentUser(req)) });
};

export const createRequest: RequestHandler = async (req, res) => {
  const data = await service.createRequest(req.body as CreateRequestInput, currentUser(req));
  res.status(201).json({ data });
};

export const createDirect: RequestHandler = async (req, res) => {
  const data = await service.createDirect(req.body as CreateDirectInput, currentUser(req));
  res.status(201).json({ data });
};

export const cancel: RequestHandler = async (req, res) => {
  res.json({ data: await service.cancelTransfer(idOf(req), currentUser(req)) });
};

export const approve: RequestHandler = async (req, res) => {
  res.json({
    data: await service.approveTransfer(idOf(req), req.body as ApproveInput, currentUser(req)),
  });
};

export const reject: RequestHandler = async (req, res) => {
  res.json({
    data: await service.rejectTransfer(idOf(req), req.body as RejectInput, currentUser(req)),
  });
};

export const send: RequestHandler = async (req, res) => {
  res.json({
    data: await service.sendTransfer(idOf(req), req.body as SendInput, currentUser(req)),
  });
};

export const receive: RequestHandler = async (req, res) => {
  res.json({
    data: await service.receiveTransfer(idOf(req), req.body as ReceiveInput, currentUser(req)),
  });
};
