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

  // Step 4: Driver Information (Optional - defaults to the car's assigned driver)
  driverInfo: z
    .object({
      name: z.string().optional(),
      phoneNumber: z.string().optional(),
      email: z.string().email().optional(),
      dateOfBirth: z.string().optional(),
      age: z
        .union([z.number(), z.string()])
        .optional()
        .transform((val) => {
          if (val === undefined || val === null || val === "") return undefined;
          const parsed = parseInt(String(val).replace(/\+/g, ""), 10);
          return Number.isNaN(parsed) ? undefined : parsed;
        }),
      licenseState: z.string().optional(),
      licenseNumber: z.string().optional(),
      licenseExpiry: z.string().optional(),
    })
    .optional(),

  // Step 5: Payment Details
  payment: z.object({
    paymentOption: z.enum(["PAY_NOW", "PAY_AT_DESK"]),
    paymentMethod: z.string().optional().default("Credit Card"),
    cardDetails: z
      .object({
        cardNumber: z.string().optional(),
        nameOnCard: z.string().optional(),
        expiryDate: z.string().optional(),
        cvv: z.string().optional(),
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

export const cancelBookingSchema = z.object({
  reason: z.string().optional(),
});
