// src/middlewares/conditional-cloudinary-upload.ts
import type { NextFunction, Request, Response } from 'express';

import { handleCloudinaryUpload } from './handle-cloudinary-upload.js';

const conditionalCloudinaryUpload = (options: Parameters<typeof handleCloudinaryUpload>[0], fieldName: string) => {
  const uploadMiddleware = handleCloudinaryUpload(options, fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    const fieldFiles = !req.files || Array.isArray(req.files) ? undefined : req.files[fieldName];
    const hasFile =
      Boolean(req.file) || // single file
      (Array.isArray(req.files) && req.files.length > 0) ||
      (Array.isArray(fieldFiles) && fieldFiles.length > 0);

    if (hasFile) {
      return uploadMiddleware(req, res, next);
    }
    next();
    return;
  };
};

export default conditionalCloudinaryUpload;
