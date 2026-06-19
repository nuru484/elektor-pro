// src/utils/http.ts
// Standard success-envelope and pagination helpers used by every controller.
import type { Response } from 'express';

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  HTTP_STATUS_CODES,
  MAX_PAGE_SIZE,
} from '../config/constants.js';

export interface PaginationMeta {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  limit: number;
  page: number;
  skip: number;
}

/**
 * Normalize page/limit query values into safe, bounded pagination params.
 */
export const parsePagination = (query: {
  limit?: number | string;
  page?: number | string;
}): PaginationParams => {
  const page = Math.max(DEFAULT_PAGE, Number(query.page) || DEFAULT_PAGE);
  const rawLimit = Number(query.limit) || DEFAULT_PAGE_SIZE;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, rawLimit));
  return { limit, page, skip: (page - 1) * limit };
};

export const buildMeta = (
  total: number,
  page: number,
  limit: number,
): PaginationMeta => ({
  limit,
  page,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

export const sendOk = <T>(res: Response, message: string, data: T): void => {
  res.status(HTTP_STATUS_CODES.OK).json({ data, message, success: true });
};

export const sendCreated = <T>(
  res: Response,
  message: string,
  data: T,
): void => {
  res.status(HTTP_STATUS_CODES.CREATED).json({ data, message, success: true });
};

export const sendList = <T>(
  res: Response,
  message: string,
  data: T[],
  meta: PaginationMeta,
  summary?: Record<string, unknown>,
): void => {
  res
    .status(HTTP_STATUS_CODES.OK)
    .json({ data, message, meta, success: true, ...(summary ? { summary } : {}) });
};
