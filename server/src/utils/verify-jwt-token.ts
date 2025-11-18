// src/utils/verify-jwt-token.ts
import type { ITokenPayload } from '@/types/auth.types.js';
import jwt, { type VerifyErrors } from 'jsonwebtoken';

export const verifyJwtToken = <T = ITokenPayload>(token: string, secret: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err: VerifyErrors | null, decoded: unknown) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as T);
      }
    });
  });
};
