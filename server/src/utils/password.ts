// src/utils/password.ts
import { compare, hash } from 'bcrypt';

import { BCRYPT_SALT_ROUNDS } from '../config/constants.js';

export const hashPassword = (plain: string): Promise<string> =>
  hash(plain, BCRYPT_SALT_ROUNDS);

export const verifyPassword = (plain: string, hashed: string): Promise<boolean> =>
  compare(plain, hashed);
