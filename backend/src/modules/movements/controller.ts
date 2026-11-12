import type { RequestHandler } from "express";
import { currentUser, validatedQuery } from "../../utils/http";
import type { ListMovementsQuery } from "./schema";
import * as service from "./service";

export const list: RequestHandler = async (req, res) => {
  res.json(await service.listMovements(validatedQuery<ListMovementsQuery>(req), currentUser(req)));
};
