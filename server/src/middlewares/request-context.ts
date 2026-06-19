// src/middlewares/request-context.ts
import type { NextFunction, Request, Response } from 'express';

import { randomUUID } from 'node:crypto';

/**
 * Attach a correlation id to every request and echo it on the response so a
 * client error can be traced to server logs.
 */
export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const incoming = req.get('x-request-id');
  const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};
