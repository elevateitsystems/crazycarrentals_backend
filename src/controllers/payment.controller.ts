import type { Request, Response } from "express";
import { env } from "../config/env.js";
import * as bookingService from "../services/booking.service.js";

export const getPaymentConfig = (_req: Request, res: Response) => {
  if (!env.STRIPE_PUBLISHABLE_KEY) {
    res.status(500).json({
      success: false,
      message: "Stripe publishable key is not configured",
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: { publishableKey: env.STRIPE_PUBLISHABLE_KEY },
  });
};

export const stripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];

  if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) {
    res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook request",
    });
    return;
  }

  try {
    await bookingService.handleStripeWebhook(req.body, signature);
    res.status(200).json({ received: true });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Stripe webhook failed",
    });
  }
};
