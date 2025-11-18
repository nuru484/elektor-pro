// src/controllers/authentication/login.ts
import type { Request, Response, NextFunction } from 'express';
import { compare } from 'bcrypt';
import jwt from 'jsonwebtoken';
import ENV from '../../config/env.js';
import prisma from '../../config/prismaClient.js';
import {
  asyncHandler,
  NotFoundError,
  UnauthorizedError,
} from '../../middlewares/error-handler.js';
import { CookieManager } from '../../utils/CookieManager.js';
import type {
  ITokenPayload,
  IRefreshTokenPayload,
} from '../../types/auth.types.js';
import { validateAndFormatPhone } from '../../utils/validate-phone.js';
import {
  isPhoneNumber,
  loginSchema,
} from '../../validations/login-validation.js';
import validationMiddleware from '../../middlewares/validation.js';

const USER_SELECT_WITH_PASSWORD = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  status: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  profilePicture: true,
  password: true,
} as const;

export const handleLogin: (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void> = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { password, emailOrPhone } = req.body;

    if (!emailOrPhone) {
      throw new UnauthorizedError('Please provide email or phone number');
    }

    let email: string | undefined;
    let formattedPhone: string | undefined;

    if (isPhoneNumber(emailOrPhone)) {
      const phoneValidation = validateAndFormatPhone(emailOrPhone, 'GH');
      formattedPhone = phoneValidation.e164Format;
    } else {
      email = emailOrPhone;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(formattedPhone ? [{ phone: formattedPhone }] : []),
        ],
      },
      select: USER_SELECT_WITH_PASSWORD,
    });

    if (!user) {
      throw new NotFoundError('Invalid credentials');
    }

    if (!password || !user.password) {
      throw new Error('Password or hash missing');
    }

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const accessToken = jwt.sign(
      { id: user.id.toString(), role: user.role } as ITokenPayload,
      ENV.ACCESS_TOKEN_SECRET,
      { expiresIn: '30m' },
    );

    const refreshToken = jwt.sign(
      { id: user.id.toString(), role: user.role } as IRefreshTokenPayload,
      ENV.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' },
    );

    CookieManager.clearAllTokens(res);
    CookieManager.setAccessToken(res, accessToken);
    CookieManager.setRefreshToken(res, refreshToken);

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: userWithoutPassword,
    });
  },
);

export const login = [
  validationMiddleware.create(loginSchema),
  handleLogin,
] as const;
