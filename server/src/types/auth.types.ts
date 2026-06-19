// src/types/auth.types.ts
import { Role } from '../../generated/prisma/client.js';

export interface IRefreshTokenPayload {
  id: string;
}

export interface ITokenPayload {
  id: string;
  role: Role;
}

export interface IUserLoginInput {
  email: string;
  password: string;
}
