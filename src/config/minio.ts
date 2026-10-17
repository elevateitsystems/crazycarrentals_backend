import * as Minio from 'minio';
import { env } from './env.js';

export const minioClient = new Minio.Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export const getMinioPublicUrl = (objectName: string): string => {
  if (env.MINIO_PUBLIC_URL) {
    const baseUrl = env.MINIO_PUBLIC_URL.replace(/\/+$/, '');
    return `${baseUrl}/${env.MINIO_BUCKET_NAME}/${objectName}`;
  }

  const protocol = env.MINIO_USE_SSL ? 'https' : 'http';
  return `${protocol}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}/${env.MINIO_BUCKET_NAME}/${objectName}`;
};

export const initMinioBucket = async (): Promise<void> => {
  try {
    const bucketExists = await minioClient.bucketExists(env.MINIO_BUCKET_NAME);
    if (!bucketExists) {
      await minioClient.makeBucket(env.MINIO_BUCKET_NAME);
      console.log(`[MinIO] Bucket "${env.MINIO_BUCKET_NAME}" created successfully.`);
    }

    // Set bucket policy to allow public read access for uploaded car images
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${env.MINIO_BUCKET_NAME}/*`],
        },
      ],
    };

    await minioClient.setBucketPolicy(
      env.MINIO_BUCKET_NAME,
      JSON.stringify(policy),
    );
    console.log(`[MinIO] Bucket "${env.MINIO_BUCKET_NAME}" is configured and ready.`);
  } catch (error) {
    console.warn('[MinIO] Bucket initialization warning:', error);
  }
};
