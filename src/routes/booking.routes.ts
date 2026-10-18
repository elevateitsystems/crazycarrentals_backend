import { Router } from "express";
import adminBookingRoutes from "./booking.admin.routes.js";
import * as bookingController from "../controllers/booking.controller.js";
import { authenticate, optionalAuthenticate } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  createBookingSchema,
  estimateBookingSchema,
  confirmPaymentSchema,
  cancelBookingSchema,
} from "../validators/booking.validator.js";

const router = Router();

router.use("/admin", adminBookingRoutes);

// 1. Get available extras and pricing rules
router.get("/extras", bookingController.getExtras);

// 2. Estimate booking pricing and check availability in real-time
router.post(
  "/estimate",
  validate(estimateBookingSchema),
  bookingController.estimateBooking
);

// 3. Create a new booking (Supports both logged-in users & guest checkout)
router.post(
  "/",
  optionalAuthenticate,
  validate(createBookingSchema),
  bookingController.createBooking
);

// 4. Get logged-in user's bookings
router.get("/my-bookings", authenticate, bookingController.getMyBookings);

// 5. Get a specific booking by ID or Reference
router.get("/my-bookings/:id", optionalAuthenticate, bookingController.getBooking);

// 6. Mark a Pay Now booking active after payment succeeds
router.post(
  "/:id/confirm-payment",
  optionalAuthenticate,
  validate(confirmPaymentSchema),
  bookingController.confirmPayment
);

// 7. Cancel a booking
router.post(
  "/:id/cancel",
  optionalAuthenticate,
  validate(cancelBookingSchema),
  bookingController.cancelBooking
);

export default router;
