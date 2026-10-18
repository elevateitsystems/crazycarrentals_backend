import multer from 'multer';
import type { Request } from 'express';
import { AppError } from '../utils/app-error.js';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        400,
        `Invalid file type "${file.mimetype}". Only JPEG, JPG, PNG, and WEBP images are allowed.`,
      ) as unknown as Error,
    );
  }
};

const storage = multer.memoryStorage();

const imageUploader = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
});

/**
 * Universal middleware to handle a single file upload for any field name.
 * Example: `uploadSingle('avatar')`, `uploadSingle('thumbnail')`, `uploadSingle('license')`
 */
export const uploadSingle = (fieldName: string) => imageUploader.single(fieldName);

/**
 * Universal middleware to handle multiple file uploads for any field name.
 * Example: `uploadMultiple('images', 10)`, `uploadMultiple('documents', 5)`
 */
export const uploadMultiple = (fieldName: string, maxCount: number = 10) =>
  imageUploader.array(fieldName, maxCount);

// Convenience pre-configured middlewares for common entity uploads:
export const uploadAvatar = imageUploader.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

export const uploadProfileImage = uploadSingle('image');
export const uploadCarImages = uploadMultiple('images', 10);
export const uploadSingleImage = uploadSingle('image');

/**
 * Helper to extract a single file from req regardless of whether
 * it was uploaded via .single(), .array(), or .fields().
 */
export const extractSingleFile = (req: Request): Express.Multer.File | undefined => {
  if (req.file) return req.file;

  const files = req.files as
    | Record<string, Express.Multer.File[]>
    | Express.Multer.File[]
    | undefined;

  if (Array.isArray(files)) {
    return files[0];
  }

  if (files && typeof files === 'object') {
    if (files.avatar && files.avatar[0]) return files.avatar[0];
    if (files.image && files.image[0]) return files.image[0];
    const firstKey = Object.keys(files)[0];
    if (firstKey && files[firstKey]?.[0]) return files[firstKey][0];
  }

  return undefined;
};
