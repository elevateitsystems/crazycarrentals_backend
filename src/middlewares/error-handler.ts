
import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/app-error.js';
import { env } from '../config/env.js';

export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    res.status(409).json({
      success: false,
      message: 'A record with this unique value already exists',
    });
    return;
  }

  if (env.NODE_ENV !== 'production') {
    console.error(error);
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};
