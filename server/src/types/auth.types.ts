// src/types/auth.types.ts
import { Role } from '@/prisma/index.js';

export interface IUserLoginInput {
  password: string;
  email: string;
}

export interface ITokenPayload {
  id: string;
  role: Role;
}

export interface IRefreshTokenPayload {
  id: string;
}
