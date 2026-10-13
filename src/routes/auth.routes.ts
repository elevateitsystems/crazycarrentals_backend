
import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import {
    changePasswordSchema,
    forgetPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.post(
  '/register',
  validate(registerSchema),
  authController.register,
);

router.post(
  '/login',
  validate(loginSchema),
  authController.login,
);

router.post(
  '/forget-password',
  validate(forgetPasswordSchema),
  authController.forgetPassword,
);

router.post(
    '/reset-password',
    validate(resetPasswordSchema),
    authController.resetPassword,
)

router.post(
    '/change-password',
    authenticate,
    validate(changePasswordSchema),
    authController.changePassword,
)

router.put(
  '/profile',
  authenticate,
  validate(updateProfileSchema),
  authController.updateProfile,
)


router.get(
  '/me',
  authenticate,
  authController.profile,
);

export default router;
