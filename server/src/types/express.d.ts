// types/express.d.ts
import 'express';

import type { ITokenPayload } from './auth.types.ts';

declare module 'express' {
  export interface Request {
    requestId?: string;
    user?: ITokenPayload;
  }
}
