import Stripe from "stripe";
import { env } from "./env.js";

// Match the API version selected on the Stripe webhook destination.
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil" as Stripe.LatestApiVersion,
  typescript: true,
});
