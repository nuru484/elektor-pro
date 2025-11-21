// src/types/auth.types.ts
import { Role } from '@/prisma/index.js';

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
