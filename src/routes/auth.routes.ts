import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { adminOnly } from "../middlewares/adminOnly.js";
import { validate } from "../middlewares/validate.js";
import { uploadAvatar } from "../middlewares/upload.middleware.js";
import {
  changePasswordSchema,
  forgetPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  adminUpdateUserSchema,
} from "../validators/auth.validator.js";

const router = Router();

router.post("/register", validate(registerSchema), authController.register);

router.post("/login", validate(loginSchema), authController.login);

router.post(
  "/forget-password",
  validate(forgetPasswordSchema),
  authController.forgetPassword,
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  authController.resetPassword,
);

router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);

router.patch(
  "/profile",
  authenticate,
  uploadAvatar,
  validate(updateProfileSchema),
  authController.updateProfile,
);

router.get("/me", authenticate, authController.profile);

// Admin side

router.get("/users", authenticate, adminOnly, authController.getAllUsers);

router.get("/user/:id", authenticate, adminOnly, authController.getUserById);

router.patch(
  "/user/update/:id",
  authenticate,
  adminOnly,
  validate(adminUpdateUserSchema),
  authController.updateUserById,
);

router.delete(
  "/user/delete/:id",
  authenticate,
  adminOnly,
  authController.deleteUserById,
);

export default router;
