import Stripe from "stripe";
import { stripe } from "../config/stripe.js";
import { env } from "../config/env.js";

export const toCents = (amount: number) => Math.round(Number(amount.toFixed(2)) * 100);

export const constructStripeEvent = (rawBody: Buffer, signature: string) =>
  stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

const cardFromIntent = (intent: Stripe.PaymentIntent) => {
  const charge = intent.latest_charge;
  if (!charge || typeof charge === "string") {
    return { cardLast4: null as string | null, cardBrand: null as string | null };
  }

  const details = charge.payment_method_details;
  if (details?.type !== "card" || !details.card) {
    return { cardLast4: null, cardBrand: null };
  }

  return {
    cardLast4: details.card.last4 ?? null,
    cardBrand: details.card.brand ?? null,
  };
};

export const createCardPayment = async (input: {
  bookingId: string;
  bookingReference: string | null;
  amount: number;
  email: string;
}) => {
  const amount = toCents(input.amount);
  if (amount < 50) {
    throw new Error("Card payment amount is below the Stripe minimum");
  }

  const intent = await stripe.paymentIntents.create({
    amount,
    currency: "aud",
    receipt_email: input.email,
    description: `Crazy Car Rentals ${input.bookingReference ?? input.bookingId}`,
    automatic_payment_methods: { enabled: true },
    metadata: {
      bookingId: input.bookingId,
      bookingReference: input.bookingReference ?? "",
    },
  });

  if (!intent.client_secret) {
    throw new Error("Stripe did not return a client secret");
  }

  return {
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret,
  };
};

export const requireSucceededCardPayment = async (paymentIntentId: string, amount: number) => {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (intent.status !== "succeeded") {
    throw new Error("Card payment has not succeeded yet");
  }

  if (intent.amount !== toCents(amount) || intent.currency !== "aud") {
    throw new Error("Paid amount does not match this booking");
  }

  let card = { cardLast4: null as string | null, cardBrand: null as string | null };
  try {
    const expanded = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    card = cardFromIntent(expanded);
  } catch {
    // Card display details are optional. The payment itself has succeeded.
  }

  return {
    paymentIntentId: intent.id,
    bookingId: intent.metadata.bookingId,
    ...card,
  };
};

export const refundCardPayment = async (paymentIntentId: string) => {
  try {
    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
    return refund.status ?? "pending";
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError && error.code === "charge_already_refunded") {
      return "succeeded";
    }
    throw error;
  }
};

export const cancelOpenCardPayment = async (paymentIntentId: string) => {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (intent.status === "succeeded") {
    await refundCardPayment(paymentIntentId);
    return "refunded" as const;
  }

  if (intent.status === "canceled") {
    return "cancelled" as const;
  }

  await stripe.paymentIntents.cancel(paymentIntentId);
  return "cancelled" as const;
};
