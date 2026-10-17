
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({

  NODE_ENV: z.enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1d'),

  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().int().default(9000),
  MINIO_USE_SSL: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .default(false),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET_NAME: z.string().default('crazycarrentals'),
  MINIO_PUBLIC_URL: z.string().optional(),
  
});

export const env = envSchema.parse(process.env);
