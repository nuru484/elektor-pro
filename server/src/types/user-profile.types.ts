// src/types/user/user-profile.types.ts (additions)
import { Role, Status } from '../../generated/prisma/client.js';

export interface IUser {
  createdAt: Date;
  creator: IUserCreator | null;
  email: null | string;
  firstName: string;
  id: string;
  lastName: string;
  phone: null | string;
  profilePicture?: null | string;
  role: Role;
  status: Status;
  updatedAt: Date;
}

export interface IUserCreator {
  email: null | string;
  firstName: string;
  id: string;
  lastName: string;
  phone: null | string;
  role: Role;
}

export interface IUserQueryFilters {
  emailVerified?: boolean;
  phoneVerified?: boolean;
  role?: Role;
  search?: string;
  status?: Status;
}

export interface IUserQueryOptions {
  limit?: number;
  page?: number;
  sortBy?: 'createdAt' | 'email' | 'firstName' | 'lastName' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface IUserResponse {
  data: IUser;
  message: string;
  success: string;
}

export interface IUserRoleUpdateInput {
  role: Role;
}

export interface IUsersPaginatedResponse {
  data: IUser[];
  message: string;
  meta: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
}

export interface IUserUpdateInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: Role;
  status?: Status;
}
