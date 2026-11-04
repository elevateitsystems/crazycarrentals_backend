import { Router } from "express";
import * as extraController from "../controllers/extra.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { adminOnly } from "../middlewares/adminOnly.js";
import { validate } from "../middlewares/validate.js";
import {
  createExtraSchema,
  updateExtraSchema,
} from "../validators/extra.validator.js";

const router = Router();

router.use(authenticate, adminOnly);

router.post("/add", validate(createExtraSchema), extraController.createExtra);
router.get("/all", extraController.getAllExtras);
router.get("/:id", extraController.getExtraById);
router.patch(
  "/update/:id",
  validate(updateExtraSchema),
  extraController.updateExtra,
);
router.delete("/delete/:id", extraController.deleteExtra);

export default router;
