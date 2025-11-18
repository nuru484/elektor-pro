// src/types/user/user-profile.types.ts (additions)
import { Role, Status } from '@/prisma/index.js';

export interface IUserCreator {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: Role;
}

export interface IUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: Status;
  profilePicture?: string | null;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  creator: IUserCreator | null;
}

export interface IUsersPaginatedResponse {
  message: string;
  data: IUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IUserResponse {
  success: string;
  message: string;
  data: IUser;
}

export interface IUserQueryFilters {
  role?: Role;
  status?: Status;
  search?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

export interface IUserQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'firstName' | 'lastName' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export interface IUserUpdateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status?: Status;
  role?: Role;
}

export interface IUserRoleUpdateInput {
  role: Role;
}
