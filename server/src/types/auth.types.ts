// src/types/auth.types.ts
import { Role } from '../../generated/prisma/client.js';

export interface IRefreshTokenPayload {
  id: string;
}

export interface ITokenPayload {
  id: string;
  role: Role;
  /** Present for session-backed logins. */
  sessionId?: string;
}

export interface IUserLoginInput {
  email: string;
  password: string;
}
