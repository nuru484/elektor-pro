// src/middlewares/request-context.ts
//
// Per-request correlation id. Honors an inbound X-Request-Id from a trusted
// proxy/edge (so one id follows the request across hops) but only when it is
// shaped like an id - anything else is attacker-controllable log content and
// gets replaced. The id is echoed on the response so clients can quote it in
// bug reports, and the error handler + HTTP logger stamp it on every line.
import type { NextFunction, Request, Response } from 'express';

import { randomUUID } from 'node:crypto';

/** Conservative shape for an acceptable inbound id (UUIDs, trace ids, etc.). */
const INBOUND_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const incoming = req.get('x-request-id');
  const requestId =
    incoming && INBOUND_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};
