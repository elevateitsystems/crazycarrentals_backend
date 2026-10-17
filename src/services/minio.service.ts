import crypto from 'node:crypto';
import path from 'node:path';
import { minioClient, getMinioPublicUrl } from '../config/minio.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

/**
 * Upload any single file to MinIO into the specified folder.
 * @param file Multer file object from req.file
 * @param folder Subfolder inside the bucket (e.g., 'profiles', 'cars', 'documents', 'banners')
 * @returns Public URL of the uploaded file
 */
export const uploadFileToMinio = async (
  file: Express.Multer.File,
  folder: string = 'uploads',
): Promise<string> => {
  if (!file || !file.buffer) {
    throw new AppError(400, 'Invalid file provided for upload');
  }

  const rawExt = path.extname(file.originalname).toLowerCase();
  const ext =
    rawExt ||
    (file.mimetype === 'image/png'
      ? '.png'
      : file.mimetype === 'image/webp'
        ? '.webp'
        : '.jpg');

  const cleanBaseName = path
    .basename(file.originalname, rawExt)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 30);

  const uniqueSuffix = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const objectName = `${folder}/${cleanBaseName}_${uniqueSuffix}${ext}`;

  try {
    await minioClient.putObject(
      env.MINIO_BUCKET_NAME,
      objectName,
      file.buffer,
      file.size,
      {
        'Content-Type': file.mimetype || 'application/octet-stream',
      },
    );

    return getMinioPublicUrl(objectName);
  } catch (error) {
    console.error('[MinIO] Error uploading file to MinIO:', error);
    throw new AppError(
      500,
      'Failed to upload file to storage service. Ensure MinIO is running.',
    );
  }
};

/**
 * Upload multiple files to MinIO into the specified folder.
 * @param files Multer files array from req.files
 * @param folder Subfolder inside the bucket (e.g., 'cars', 'galleries', etc.)
 * @returns Array of public URLs
 */
export const uploadFilesToMinio = async (
  files: Express.Multer.File[],
  folder: string = 'uploads',
): Promise<string[]> => {
  if (!files || files.length === 0) {
    return [];
  }

  return Promise.all(files.map((file) => uploadFileToMinio(file, folder)));
};

/**
 * Delete a file from MinIO by either its full public URL or relative object name.
 * @param fileUrlOrObjectName Full URL or object key (e.g. 'profiles/photo_123.jpg')
 */
export const deleteFileFromMinio = async (
  fileUrlOrObjectName: string,
): Promise<void> => {
  if (!fileUrlOrObjectName) return;

  try {
    let objectName = fileUrlOrObjectName;
    const bucketSegment = `/${env.MINIO_BUCKET_NAME}/`;
    if (objectName.includes(bucketSegment)) {
      objectName = objectName.split(bucketSegment)[1] || '';
    }

    if (objectName) {
      await minioClient.removeObject(env.MINIO_BUCKET_NAME, objectName);
    }
  } catch (error) {
    console.warn('[MinIO] Warning: Failed to delete file from MinIO:', error);
  }
};

// Convenient short alias exports for clean usage across any service
export const uploadFile = uploadFileToMinio;
export const uploadFiles = uploadFilesToMinio;
export const deleteFile = deleteFileFromMinio;
