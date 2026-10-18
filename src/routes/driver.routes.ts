import { Router } from "express";
import * as driverController from "../controllers/driver.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { adminOnly } from "../middlewares/adminOnly.js";
import { validate } from "../middlewares/validate.js";
import {
  createDriverSchema,
  updateDriverSchema,
} from "../validators/driver.validator.js";

const router = Router();

router.use(authenticate, adminOnly);

router.post(
  "/add",
  validate(createDriverSchema),
  driverController.createDriver,
);
router.get("/all", driverController.getAllDrivers);
router.get("/:id", driverController.getDriverById);
router.patch(
  "/update/:id",
  validate(updateDriverSchema),
  driverController.updateDriver,
);
router.delete("/delete/:id", driverController.deleteDriver);

export default router;
