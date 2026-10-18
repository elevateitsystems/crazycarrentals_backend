import { z } from "zod";

export const estimateBookingSchema = z.object({
  carId: z.string().min(1, "carId is required"),
  pickupDate: z.string().min(1, "pickupDate is required"),
  pickupTime: z.string().optional().default("10:00"),
  returnDate: z.string().min(1, "returnDate is required"),
  returnTime: z.string().optional().default("10:00"),
  extraServiceIds: z.array(z.string()).optional().default([]),
  airportShuttle: z.boolean().optional().default(false),
  paymentOption: z.enum(["PAY_NOW", "PAY_AT_DESK"]).optional().default("PAY_NOW"),
});

export const createBookingSchema = z.object({
  carId: z.string().min(1, "carId is required"),

  // Step 1: Rental Details
  pickupDate: z.string().min(1, "pickupDate is required"),
  pickupTime: z.string().min(1, "pickupTime is required"),
  pickupLocation: z.string().min(1, "pickupLocation is required"),
  returnDate: z.string().min(1, "returnDate is required"),
  returnTime: z.string().min(1, "returnTime is required"),
  returnLocation: z.string().min(1, "returnLocation is required"),

  // Step 2: Extras
  extraServiceIds: z.array(z.string()).optional().default([]),

  // Step 3: Your Details
  bookingPersonDetails: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email format"),
    phoneNumber: z.string().min(4, "Phone number is required"),
  }),
  airportShuttle: z.boolean().optional().default(false),

  // Step 4 shows the driver already assigned to the car. Do not send a licence.

  // Step 5: Payment. Card number and CVV are not stored.
  payment: z.object({
    paymentOption: z.enum(["PAY_NOW", "PAY_AT_DESK"]),
    paymentMethod: z.enum(["Credit Card", "Debit Card"]).optional().default("Credit Card"),
    stripePaymentIntentId: z.string().trim().min(1).optional(),
    cardDetails: z
      .object({
        cardLast4: z.string().regex(/^\d{4}$/).optional(),
        cardBrand: z.string().trim().max(20).optional(),
        cardNumber: z.string().trim().optional(),
        nameOnCard: z.string().trim().optional(),
      })
      .optional(),
    billingAddress: z
      .object({
        street: z.string().optional(),
        suburb: z.string().optional(),
        state: z.string().optional(),
        postcode: z.string().optional(),
      })
      .optional(),
  }),
});

const optionalBody = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value == null ? {} : value), schema);

export const confirmPaymentSchema = optionalBody(
  z.object({
    email: z.string().trim().email().optional(),
    stripePaymentIntentId: z.string().trim().min(1).optional(),
  }),
);

export const cancelBookingSchema = optionalBody(
  z.object({
    reason: z.string().optional(),
  }),
);
