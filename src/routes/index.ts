
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import carRoutes from './car.routes.js';
import uploadRoutes from './upload.routes.js';
import bookingRoutes from './booking.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/cars', carRoutes);
router.use('/upload', uploadRoutes);
router.use('/bookings', bookingRoutes);

export default router;
