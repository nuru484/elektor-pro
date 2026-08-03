// src/utils/CookieManager.ts
//
// Typed access to the auth cookies (httpOnly access + refresh tokens). A plain
// object of functions rather than a static-only class; call sites keep the
// `CookieManager.x()` shape.
import type { Request, Response } from 'express';

import ENV from '../config/env.js';
import { UnauthorizedError } from '../middlewares/error-handler.js';

export interface CookieOptions {
  domain?: string | undefined;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'lax' | 'none' | 'strict';
  secure?: boolean;
}

// Default options that apply to all cookies
const defaultOptions: CookieOptions = {
  domain: ENV.COOKIE_DOMAIN || undefined,
  httpOnly: true,
  path: '/',
  sameSite: 'lax',
  secure: ENV.NODE_ENV === 'production',
};

// Specific configurations for different token types
const tokenConfigs = {
  accessToken: {
    ...defaultOptions,
  },
  refreshToken: {
    ...defaultOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
} as const satisfies Record<string, CookieOptions>;

/** cookie-parser puts string values on req.cookies; type the lookup once. */
const cookieOf = (req: Request, name: string): string | undefined => {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[name];
};

const setCookie = (res: Response, name: string, value: string, options: CookieOptions = {}): void => {
  res.cookie(name, value, {
    ...defaultOptions,
    ...options,
  });
};

const clearToken = (res: Response, tokenName: 'accessToken' | 'refreshToken'): void => {
  setCookie(res, tokenName, '', {
    ...defaultOptions,
    maxAge: 0,
  });
};

const clearAllTokens = (res: Response): void => {
  clearToken(res, 'accessToken');
  clearToken(res, 'refreshToken');
};

const getAccessToken = (req: Request): string => {
  const token = cookieOf(req, 'accessToken');
  if (!token) {
    throw new UnauthorizedError('Access token not found. Please login', {
      code: 'MISSING_TOKEN',
      layer: 'jwt',
    });
  }
  return token;
};

const getRefreshToken = (req: Request): string => {
  const token = cookieOf(req, 'refreshToken');
  if (!token) {
    throw new UnauthorizedError('Refresh token not found. Please login', {
      code: 'MISSING_TOKEN',
      layer: 'jwt',
    });
  }
  return token;
};

const getCookie = (req: Request, name: string, required = false): null | string => {
  const value = cookieOf(req, name) ?? null;

  if (required && !value) {
    throw new UnauthorizedError(`Cookie ${name} not found`, {
      code: 'MISSING_COOKIE',
      context: { cookieName: name },
      layer: 'cookie',
    });
  }

  return value;
};

const setAccessToken = (res: Response, token: string): void => {
  setCookie(res, 'accessToken', token, tokenConfigs.accessToken);
};

const setRefreshToken = (res: Response, token: string): void => {
  setCookie(res, 'refreshToken', token, tokenConfigs.refreshToken);
};

export const CookieManager = {
  clearAllTokens,
  clearToken,
  getAccessToken,
  getCookie,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
};
