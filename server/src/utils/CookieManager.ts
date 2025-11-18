// src/utils/CookieManager.ts
import type { Request, Response } from 'express';
import ENV from '../config/env.js';
import { UnauthorizedError } from '../middlewares/error-handler.js';

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  domain?: string | undefined;
  maxAge?: number;
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string;
}

export class CookieManager {
  // Default options that apply to all cookies
  private static defaultOptions: CookieOptions = {
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production',
    domain: ENV.COOKIE_DOMAIN || undefined,
    sameSite: 'lax',
    path: '/',
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

  public static setAccessToken(res: Response, token: string): void {
    this.setCookie(res, 'accessToken', token, this.tokenConfigs.accessToken);
  }

  public static setRefreshToken(res: Response, token: string): void {
    this.setCookie(res, 'refreshToken', token, this.tokenConfigs.refreshToken);
  }

  public static clearToken(res: Response, tokenName: 'accessToken' | 'refreshToken'): void {
    this.setCookie(res, tokenName, '', {
      ...this.defaultOptions,
      maxAge: 0,
    });
  }

  public static clearAllTokens(res: Response): void {
    this.clearToken(res, 'accessToken');
    this.clearToken(res, 'refreshToken');
  }

  private static setCookie(res: Response, name: string, value: string, options: CookieOptions = {}): void {
    res.cookie(name, value, {
      ...this.defaultOptions,
      ...options,
    });
  }

  public static getAccessToken(req: Request): string {
    if (!req.cookies || !req.cookies.accessToken) {
      throw new UnauthorizedError('Access token not found. Please login', {
        layer: 'jwt',
        code: 'MISSING_TOKEN',
        context: { token: null },
      });
    }
    return req.cookies.accessToken;
  }

  public static getRefreshToken(req: Request): string {
    if (!req.cookies || !req.cookies.refreshToken) {
      throw new UnauthorizedError('Refresh token not found. Please login', {
        layer: 'jwt',
        code: 'MISSING_TOKEN',
        context: { token: null },
      });
    }
    return req.cookies.refreshToken;
  }

  public static getCookie(req: Request, name: string, required: boolean = false): string | null {
    const value = req.cookies?.[name] || null;

    if (required && !value) {
      throw new UnauthorizedError(`Cookie ${name} not found`, {
        layer: 'cookie',
        code: 'MISSING_COOKIE',
        context: { cookieName: name },
      });
    }

    return value;
  }
}
