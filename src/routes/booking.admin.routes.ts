import { Router } from "express";
import * as bookingController from "../controllers/booking.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { adminOnly } from "../middlewares/adminOnly.js";
import { validate } from "../middlewares/validate.js";
import { cancelBookingSchema } from "../validators/booking.validator.js";

const router = Router();

router.use(authenticate, adminOnly);

router.get("/summary", bookingController.getAdminBookingSummary);
router.get("/all", bookingController.getAllBookingsForAdmin);
router.get("/:id", bookingController.getBookingForAdmin);
router.post("/confirm/:id", bookingController.confirmBookingForAdmin);
router.post("/complete/:id", bookingController.completeBookingForAdmin);
router.post("/collect-payment/:id", bookingController.collectDeskPayment);
router.post(
  "/cancel/:id",
  validate(cancelBookingSchema),
  bookingController.cancelBooking,
);

export default router;
