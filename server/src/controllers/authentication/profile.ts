// src/controllers/authentication/profile.ts
import type { Request, RequestHandler, Response } from 'express';

import multerUpload from '../../config/multer.js';
import {
  asyncHandler,
  UnauthorizedError,
  ValidationError,
} from '../../middlewares/error-handler.js';
import validationMiddleware from '../../middlewares/validation.js';
import { profileService } from '../../services/auth/profile.service.js';
import { requestContextOf } from '../../utils/auth-session.js';
import { sendOk } from '../../utils/http.js';
import {
  confirmCodeSchema,
  requestEmailChangeSchema,
  requestPhoneChangeSchema,
  updateProfileSchema,
} from '../../validations/auth-validation.js';

const userIdOf = (req: Request): string => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user.id;
};

const handleUpdateProfile = asyncHandler(async (req: Request, res: Response) => {
  const data = await profileService.updateProfile(
    userIdOf(req),
    req.body as { firstName?: string; lastName?: string },
    requestContextOf(req),
  );
  sendOk(res, 'Profile updated', data);
});

const handleRequestEmailChange = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  const data = await profileService.requestEmailChange(userIdOf(req), email);
  sendOk(res, 'A confirmation code has been sent to the new email', data);
});

const handleConfirmEmailChange = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  const data = await profileService.confirmEmailChange(
    userIdOf(req),
    code,
    requestContextOf(req),
  );
  sendOk(res, 'Email address updated', data);
});

const handleRequestPhoneChange = asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.body as { phone: string };
  const data = await profileService.requestPhoneChange(userIdOf(req), phone);
  sendOk(res, 'A confirmation code has been sent to the new number', data);
});

const handleConfirmPhoneChange = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  const data = await profileService.confirmPhoneChange(
    userIdOf(req),
    code,
    requestContextOf(req),
  );
  sendOk(res, 'Phone number updated', data);
});

const handleUpdatePicture = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ValidationError('An image file is required', {
      code: 'VALIDATION_ERROR',
      context: { errors: [{ field: 'image', message: 'An image file is required' }] },
    });
  }
  const data = await profileService.updateProfilePicture(
    userIdOf(req),
    { buffer: req.file.buffer, mimetype: req.file.mimetype },
    requestContextOf(req),
  );
  sendOk(res, 'Profile photo updated', data);
});

export const updateProfileController: RequestHandler[] = [
  ...validationMiddleware.update(updateProfileSchema),
  handleUpdateProfile,
];

export const requestEmailChangeController: RequestHandler[] = [
  ...validationMiddleware.create(requestEmailChangeSchema),
  handleRequestEmailChange,
];

export const confirmEmailChangeController: RequestHandler[] = [
  ...validationMiddleware.create(confirmCodeSchema),
  handleConfirmEmailChange,
];

export const requestPhoneChangeController: RequestHandler[] = [
  ...validationMiddleware.create(requestPhoneChangeSchema),
  handleRequestPhoneChange,
];

export const confirmPhoneChangeController: RequestHandler[] = [
  ...validationMiddleware.create(confirmCodeSchema),
  handleConfirmPhoneChange,
];

export const updateProfilePictureController: RequestHandler[] = [
  multerUpload.single('image'),
  handleUpdatePicture,
];
