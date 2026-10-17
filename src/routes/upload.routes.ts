import { Router } from 'express';
import {
  uploadCarImages,
  uploadSingleImage,
} from '../middlewares/upload.middleware.js';
import {
  uploadFilesToMinio,
  uploadFileToMinio,
} from '../services/minio.service.js';
import { AppError } from '../utils/app-error.js';

const router = Router();

router.post('/image', uploadSingleImage, async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'No image file uploaded');
    }

    const url = await uploadFileToMinio(req.file, 'uploads');

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: { url },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/images', uploadCarImages, async (req, res, next) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new AppError(400, 'No image files uploaded');
    }

    const urls = await uploadFilesToMinio(files, 'uploads');

    res.status(201).json({
      success: true,
      message: 'Images uploaded successfully',
      data: { urls },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
