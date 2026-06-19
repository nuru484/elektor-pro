// src/config/claudinary.ts
import { v2 as cloudinaryBase, type UploadApiErrorResponse, type UploadApiResponse } from 'cloudinary';

import type {
  ICloudinaryConfig,
  ICloudinaryDeletionResponse,
  ICloudinaryUploadOptions,
  ICloudinaryUploadResult,
  ICloudinaryUploadService,
  IUploadedFile,
} from '../types/cloudinary.types.js';

import { CustomError, InternalServerError, ValidationError } from '../middlewares/error-handler.js';
import logger from '../utils/logger.js';
import { isValidBase64Image } from '../utils/validate-base64-image.js';
import ENV from './env.js';

const MAX_UPLOAD_RETRIES = 3;
const RETRY_DELAY_MS = 300;

export const defaultCloudinaryConfig: ICloudinaryConfig = {
  api_key: ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
};

export const extractPublicIdFromUrl = (url: string): string => {
  try {
    const urlPath = new URL(url).pathname;

    // Split the path and find the upload segment
    const parts = urlPath.split('/');
    const uploadIndex = parts.findIndex((part) => part === 'upload');

    if (uploadIndex === -1) {
      throw new Error('Invalid Cloudinary URL: missing upload segment');
    }

    // Skip the version number if it exists (starts with 'v' followed by digits)
    let startIndex = uploadIndex + 1;
    const maybeVersion = parts[startIndex];
    if (maybeVersion && /^v\d+$/.test(maybeVersion)) {
      startIndex++;
    }

    // Join all remaining parts except the last one, then remove file extension
    const publicIdParts = parts.slice(startIndex);
    const lastPart = publicIdParts[publicIdParts.length - 1];

    // Remove file extension from the last part
    const lastPartWithoutExt = lastPart?.split('.')[0];
    publicIdParts[publicIdParts.length - 1] = lastPartWithoutExt ?? '';

    return publicIdParts.join('/');
  } catch (error) {
    logger.error(error);
    // Enhanced fallback
    const segments = url.split('/');
    const uploadIndex = segments.findIndex((segment) => segment === 'upload');

    if (uploadIndex === -1) {
      throw new Error('Invalid Cloudinary URL format');
    }

    let startIndex = uploadIndex + 1;
    // Skip version if present
    if (segments[startIndex] && /^v\d+$/.test(segments[startIndex] ?? '')) {
      startIndex++;
    }

    const publicIdSegments = segments.slice(startIndex);
    const fileName = publicIdSegments[publicIdSegments.length - 1];
    publicIdSegments[publicIdSegments.length - 1] = fileName?.split('.')[0] ?? '';

    return publicIdSegments.join('/');
  }
};

const validateConfig = (config: ICloudinaryConfig): void => {
  const requiredFields = ['cloud_name', 'api_key', 'api_secret'];
  const missingFields = requiredFields.filter((field) => !config[field as keyof ICloudinaryConfig]);
  if (missingFields.length > 0) {
    throw new Error(`Missing required Cloudinary configuration fields: ${missingFields.join(', ')}`);
  }
};

const createCloudinaryInstance = (config: ICloudinaryConfig) => {
  validateConfig(config);
  const cloudinaryInstance = cloudinaryBase;
  cloudinaryInstance.config(config);
  return cloudinaryInstance;
};

const isRetryableError = (error: Error | UploadApiErrorResponse): boolean => {
  const msg = error.message || '';
  const httpCode = 'http_code' in error && typeof error.http_code === 'number' ? error.http_code : null;

  return (
    httpCode === 429 || // rate limit
    (httpCode !== null && httpCode >= 500) ||
    msg.includes('timeout') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET')
  );
};

export const uploadToCloudinary = async (
  file: IUploadedFile | string,
  options: Partial<ICloudinaryUploadOptions> = {},
  config: ICloudinaryConfig,
): Promise<ICloudinaryUploadResult> => {
  const cloudinary = cloudinaryBase;
  cloudinary.config(config);

  if (typeof file === 'string') {
    if (!isValidBase64Image(file)) {
      throw new ValidationError('Invalid Base64 image format.');
    }
  } else if (!file?.buffer) {
    throw new ValidationError('Invalid file object. Ensure it has a buffer property.');
  }

  const uploadOptions: ICloudinaryUploadOptions = {
    resource_type: 'auto',
    ...options,
  };

  let attempts = 0;
  while (attempts < MAX_UPLOAD_RETRIES) {
    try {
      const result: UploadApiResponse = await new Promise((resolve, reject) => {
        if (typeof file === 'string') {
          void cloudinary.uploader.upload(file, uploadOptions, (error?: UploadApiErrorResponse, uploadResult?: UploadApiResponse) => {
            if (error || !uploadResult) {
              reject(new Error(error?.message ?? 'Upload failed'));
            } else {
              resolve(uploadResult);
            }
          });
        } else {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error?: UploadApiErrorResponse, uploadResult?: UploadApiResponse) => {
              if (error || !uploadResult) {
                reject(new Error(error?.message ?? 'Upload failed'));
              } else {
                resolve(uploadResult);
              }
            },
          );
          uploadStream.end(file.buffer);
        }
      });

      logger.debug(`File uploaded successfully: ${result.public_id}`);
      return {
        asset_id: result.asset_id,
        format: result.format,
        public_id: result.public_id,
        resource_type: result.resource_type,
        secure_url: result.secure_url,
      };
    } catch (error: unknown) {
      attempts++;

      if (error instanceof Error || (error as UploadApiErrorResponse)?.message) {
        const typedError = (error as UploadApiErrorResponse) || (error as Error);
        const errorMessage = typedError.message;

        if (!isRetryableError(typedError)) {
          logger.error(`Non-retryable upload error: ${errorMessage}`);
          throw new CustomError(400, `Upload failed: ${errorMessage}`);
        }

        // Retryable → retry if attempts left
        if (attempts === MAX_UPLOAD_RETRIES) {
          logger.error(`Upload failed after ${MAX_UPLOAD_RETRIES} attempts: ${errorMessage}`);
          throw new CustomError(502, `Failed to upload after retries: ${errorMessage}`);
        }

        logger.warn(`Upload attempt ${attempts} failed: ${errorMessage}. Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        // Fallback for truly unknown errors
        throw new InternalServerError('Unexpected error during upload process');
      }
    }
  }

  throw new InternalServerError('Unexpected error during upload process');
};

export const deleteFromCloudinary = async (identifier: string, config: ICloudinaryConfig): Promise<ICloudinaryDeletionResponse> => {
  if (!identifier) {
    throw new ValidationError('No Cloudinary identifier provided for deletion');
  }

  const cloudinary = createCloudinaryInstance(config);
  const publicId = identifier.includes('http') ? extractPublicIdFromUrl(identifier) : identifier;

  logger.debug(`Attempting to delete file with public ID: ${publicId}`);
  let attempts = 0;

  while (attempts < MAX_UPLOAD_RETRIES) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        type: 'upload',
      });

      logger.debug(`Cloudinary raw deletion response: ${JSON.stringify(result)}`);

      if (result?.result !== 'ok') {
        throw new Error(`Deletion failed. Cloudinary response: ${JSON.stringify(result)}`);
      }

      logger.info(`Cloudinary deletion successful: ${publicId}`);
      return result as ICloudinaryDeletionResponse;
    } catch (error) {
      attempts++;
      const errorMessage = (error as Error).message || JSON.stringify(error) || 'Unknown error';

      if (attempts === MAX_UPLOAD_RETRIES) {
        logger.error(`Deletion failed after ${MAX_UPLOAD_RETRIES} attempts: ${errorMessage}`);
        throw new CustomError(502, `Failed to delete from Cloudinary after ${MAX_UPLOAD_RETRIES} attempts: ${errorMessage}`);
      }

      logger.warn(`Deletion attempt ${attempts} failed: ${errorMessage}. Retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw new InternalServerError('Unexpected error during deletion process');
};

export const uploadMultipleToCloudinary = async (
  files: (IUploadedFile | string)[],
  options: Partial<ICloudinaryUploadOptions> = {},
  config: ICloudinaryConfig,
): Promise<ICloudinaryUploadResult[]> => {
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new ValidationError('No valid files provided for upload');
  }

  try {
    const uploadPromises = files.map((file) => uploadToCloudinary(file, options, config));
    return await Promise.all(uploadPromises);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error, 'Error uploading multiple files');
    } else {
      logger.error({ error }, 'Error uploading multiple files');
    }

    throw new CustomError(502, `Error uploading multiple files: ${(error as Error).message}`);
  }
};

/**
 * Service class for Cloudinary operations
 */
export class CloudinaryUploadService implements ICloudinaryUploadService {
  constructor(private config: ICloudinaryConfig) {}

  async deleteImage(publicId: string): Promise<ICloudinaryDeletionResponse> {
    return deleteFromCloudinary(publicId, this.config);
  }

  async uploadImage(image: IUploadedFile | string, options: Partial<ICloudinaryUploadOptions> = {}): Promise<ICloudinaryUploadResult> {
    return uploadToCloudinary(image, options, this.config);
  }
}

export const createCloudinaryService = (config: ICloudinaryConfig): ICloudinaryUploadService => {
  if (!config.api_key || !config.cloud_name || !config.api_secret) {
    throw new Error('Invalid Cloudinary config: missing apiKey or cloudName');
  }
  return new CloudinaryUploadService(config);
};

// Default service instance
export const cloudinaryService = createCloudinaryService(defaultCloudinaryConfig);
