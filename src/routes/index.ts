
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import carRoutes from './car.routes.js';
import driverRoutes from './driver.routes.js';
import uploadRoutes from './upload.routes.js';
import bookingRoutes from './booking.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import extraRoutes from './extra.routes.js';
import protectionRoutes from './protection.routes.js';
import paymentRoutes from './payment.routes.js';

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
router.use('/drivers', driverRoutes);
router.use('/upload', uploadRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin/extras', extraRoutes);
router.use('/admin/protections', protectionRoutes);
router.use('/admin', dashboardRoutes);

export default router;
