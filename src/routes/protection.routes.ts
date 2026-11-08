import { Router } from "express";
import * as protectionController from "../controllers/protection.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { adminOnly } from "../middlewares/adminOnly.js";
import { validate } from "../middlewares/validate.js";
import {
  createProtectionSchema,
  updateProtectionSchema,
} from "../validators/protection.validator.js";

const router = Router();

router.use(authenticate, adminOnly);

router.post(
  "/add",
  validate(createProtectionSchema),
  protectionController.createProtection,
);
router.get("/all", protectionController.getAllProtections);
router.get("/:id", protectionController.getProtectionById);
router.patch(
  "/update/:id",
  validate(updateProtectionSchema),
  protectionController.updateProtection,
);
router.delete("/delete/:id", protectionController.deleteProtection);

export default router;
