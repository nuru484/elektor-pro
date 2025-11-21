// src/utils/CookieManager.ts
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

export class CookieManager {
  // Default options that apply to all cookies
  private static defaultOptions: CookieOptions = {
    domain: ENV.COOKIE_DOMAIN || undefined,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: ENV.NODE_ENV === 'production',
  };

  // Specific configurations for different token types
  private static tokenConfigs = {
    accessToken: {
      ...CookieManager.defaultOptions,
    },
    refreshToken: {
      ...CookieManager.defaultOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  };

  public static clearAllTokens(res: Response): void {
    this.clearToken(res, 'accessToken');
    this.clearToken(res, 'refreshToken');
  }

  public static clearToken(res: Response, tokenName: 'accessToken' | 'refreshToken'): void {
    this.setCookie(res, tokenName, '', {
      ...this.defaultOptions,
      maxAge: 0,
    });
  }

  public static getAccessToken(req: Request): string {
    if (!req.cookies?.accessToken) {
      throw new UnauthorizedError('Access token not found. Please login', {
        code: 'MISSING_TOKEN',
        context: { token: null },
        layer: 'jwt',
      });
    }
    return req.cookies.accessToken;
  }

  public static getCookie(req: Request, name: string, required = false): null | string {
    const value = req.cookies?.[name] || null;

    if (required && !value) {
      throw new UnauthorizedError(`Cookie ${name} not found`, {
        code: 'MISSING_COOKIE',
        context: { cookieName: name },
        layer: 'cookie',
      });
    }

    return value;
  }

  public static getRefreshToken(req: Request): string {
    if (!req.cookies?.refreshToken) {
      throw new UnauthorizedError('Refresh token not found. Please login', {
        code: 'MISSING_TOKEN',
        context: { token: null },
        layer: 'jwt',
      });
    }
    return req.cookies.refreshToken;
  }

  public static setAccessToken(res: Response, token: string): void {
    this.setCookie(res, 'accessToken', token, this.tokenConfigs.accessToken);
  }

  public static setRefreshToken(res: Response, token: string): void {
    this.setCookie(res, 'refreshToken', token, this.tokenConfigs.refreshToken);
  }

  private static setCookie(res: Response, name: string, value: string, options: CookieOptions = {}): void {
    res.cookie(name, value, {
      ...this.defaultOptions,
      ...options,
    });
  }
}
