import { Router } from 'express';
import * as carController from '../controllers/car.controller.js';
import { adminOnly } from '../middlewares/adminOnly.js';
import { uploadCarImages } from '../middlewares/upload.middleware.js';

const router = Router();

// Add new car with image upload to MinIO
router.post('/add-new-car', uploadCarImages, adminOnly, carController.addNewCar);
router.get('/', carController.getAllCars);
router.get('/search', carController.searchCars);
router.post('/search', carController.searchCars);
router.get('/:id', carController.getCarById);
router.patch('/update-car/:id', uploadCarImages, adminOnly, carController.updateCarById);
router.delete('/delete-car/:id', adminOnly, carController.deleteCarById);


export default router;
