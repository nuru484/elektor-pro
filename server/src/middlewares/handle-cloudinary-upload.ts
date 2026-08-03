// src/middlewares/handle-cloudinary-upload.ts
import type { NextFunction, Request, Response } from 'express';

import type { ICloudinaryUploadOptions, ICloudinaryUploadResult } from '../types/cloudinary.types.js';

import { cloudinaryService } from '../config/cloudinary.js';
import { isValidBase64Image } from '../utils/validate-base64-image.js';
import { asyncHandler, ValidationError } from './error-handler.js';

export const handleCloudinaryUpload = (defaultOptions: Partial<ICloudinaryUploadOptions> = {}, uploadedResultsName: string) => {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      // req.body is untyped at this point (runs before Zod validation); type
      // the accesses once instead of leaking `any` through the handler.
      const body = req.body as Record<string, unknown>;

      // Merge defaultOptions with any options provided in req.body
      const bodyOptions =
        typeof body.uploadOptions === 'object' && body.uploadOptions !== null
          ? (body.uploadOptions as Partial<ICloudinaryUploadOptions>)
          : {};
      const options: Partial<ICloudinaryUploadOptions> = {
        ...defaultOptions,
        ...bodyOptions,
      };

      // Case 1: Single file upload
      if (req.file) {
        const result = await cloudinaryService.uploadImage({ ...req.file }, options);
        body[uploadedResultsName] = result.secure_url;
        next();
        return;
      }

      // Case 2: Multiple file uploads as array
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const results = await Promise.all(req.files.map((file) => cloudinaryService.uploadImage({ ...file }, options)));
        body[uploadedResultsName] = results.map((result) => result.secure_url);
        next();
        return;
      }

      // Case 3: Multiple file uploads as object (for fields)
      if (req.files && !Array.isArray(req.files)) {
        const results: Record<string, ICloudinaryUploadResult[]> = {};

        for (const fieldname in req.files) {
          const fieldFiles = req.files[fieldname];
          if (Array.isArray(fieldFiles) && fieldFiles.length > 0) {
            results[fieldname] = await Promise.all(fieldFiles.map((file) => cloudinaryService.uploadImage({ ...file }, options)));
          }
        }

        if (Object.keys(results).length > 0) {
          // Preserve per-field structure
          body[uploadedResultsName] = Object.fromEntries(
            Object.entries(results).map(([field, uploads]) => [field, uploads.map((upload) => upload.secure_url)]),
          );

          next();
          return;
        }
      }

      // Case 4: Base64 image upload
      if (typeof body.image === 'string' && isValidBase64Image(body.image)) {
        const result = await cloudinaryService.uploadImage(body.image, options);
        body[uploadedResultsName] = result.secure_url;
        next();
        return;
      }

      // No valid files found
      next(new ValidationError('No valid files found for upload'));
      return;
    } catch (error) {
      next(error);
      return;
    }
  });
};
