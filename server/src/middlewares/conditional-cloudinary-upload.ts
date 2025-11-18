// src/middlewares/conditional-cloudinary-upload.ts
import type { Request, Response, NextFunction } from 'express';
import { handleCloudinaryUpload } from './handle-cloudinary-upload.js';

const conditionalCloudinaryUpload = (options: Parameters<typeof handleCloudinaryUpload>[0], fieldName: string) => {
  const uploadMiddleware = handleCloudinaryUpload(options, fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    const hasFile =
      !!req.file || // single file
      (Array.isArray(req.files) && req.files.length > 0) ||
      (req.files &&
        typeof req.files === 'object' &&
        Array.isArray((req.files as Record<string, Express.Multer.File[]>)[fieldName]) &&
        ((req.files as Record<string, Express.Multer.File[]>)[fieldName]?.length ?? 0) > 0);

    if (hasFile) {
      return uploadMiddleware(req, res, next);
    } else {
      return next();
    }
  };
};

export default conditionalCloudinaryUpload;
