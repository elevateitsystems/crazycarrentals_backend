import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export type BookingNotice =
  | "reserved"
  | "desk_confirmed"
  | "paid"
  | "cancelled"
  | "refunded"
  | "payment_failed"
  | "expired"
  | "completed";

export type BookingMail = {
  kind: BookingNotice;
  reference: string;
  customerName: string;
  customerEmail: string;
  vehicle: string;
  pickup: string;
  returnAt: string;
  total: string;
  refundNote?: string;
};

const OFFICE_EMAIL = env.BOOKING_NOTIFY_EMAIL ?? "info@tasdriverentals.com.au";

const mailer = () => {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
};

const fromAddress = () =>
  env.SMTP_FROM || `TasDrive Rentals <${env.SMTP_USER}>`;

const sendMail = async (input: {
  to: string;
  subject: string;
  text: string;
}) => {
  const transport = mailer();
  if (!transport) {
    console.warn(`Email skipped. SMTP is not configured. ${input.subject}`);
    return false;
  }

  await transport.sendMail({
    from: fromAddress(),
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  return true;
};

const bookingLines = (mail: BookingMail) =>
  [
    `Booking reference: ${mail.reference}`,
    `Vehicle: ${mail.vehicle}`,
    `Pickup: ${mail.pickup}`,
    `Return: ${mail.returnAt}`,
    `Total: ${mail.total}`,
  ].join("\n");

const customerCopy = (mail: BookingMail) => {
  const lines = bookingLines(mail);
  switch (mail.kind) {
    case "reserved":
      return {
        subject: `Finish payment for ${mail.reference}`,
        text: `Hello ${mail.customerName},\n\nYour TasDrive vehicle is held for about 30 minutes. Complete the card payment to confirm it.\n\n${lines}\n\nThe 9% Pay Now discount is already included in the total.\n`,
      };
    case "desk_confirmed":
      return {
        subject: `Booking confirmed ${mail.reference}`,
        text: `Hello ${mail.customerName},\n\nYour TasDrive booking is confirmed. Please pay the total when you collect the vehicle.\n\n${lines}\n`,
      };
    case "paid":
      return {
        subject: `Payment received ${mail.reference}`,
        text: `Hello ${mail.customerName},\n\nYour card payment was received and your TasDrive booking is confirmed.\n\n${lines}\n`,
      };
    case "cancelled":
      return {
        subject: `Booking cancelled ${mail.reference}`,
        text: `Hello ${mail.customerName},\n\nYour TasDrive booking has been cancelled.\n\n${lines}\n${mail.refundNote ? `\n${mail.refundNote}\n` : ""}`,
      };
    case "refunded":
      return {
        subject: `Refund processed ${mail.reference}`,
        text: `Hello ${mail.customerName},\n\nThe card payment for your TasDrive booking has been refunded. It can take a few days to appear on your card.\n\n${lines}\n`,
      };
    case "payment_failed":
      return {
        subject: `Payment was not completed ${mail.reference}`,
        text: `Hello ${mail.customerName},\n\nThe card payment did not go through. Your vehicle is still held until the payment window ends. You can try the card again from the booking page.\n\n${lines}\n`,
      };
    case "expired":
      return {
        subject: `Booking hold expired ${mail.reference}`,
        text: `Hello ${mail.customerName},\n\nThe payment window for this TasDrive booking has ended, so the vehicle was released. Please start a new booking if you still need it.\n\n${lines}\n`,
      };
    case "completed":
      return {
        subject: `Rental completed ${mail.reference}`,
        text: `Hello ${mail.customerName},\n\nYour TasDrive rental is complete. Thank you for travelling with us.\n\n${lines}\n`,
      };
  }
};

const officeCopy = (mail: BookingMail) => {
  const lines = bookingLines(mail);
  const who = `${mail.customerName} <${mail.customerEmail}>`;
  const titles: Record<BookingNotice, string> = {
    reserved: "New Pay Now booking waiting for payment",
    desk_confirmed: "New pay-at-desk booking",
    paid: "Pay Now payment received",
    cancelled: "Booking cancelled",
    refunded: "Card payment refunded",
    payment_failed: "Card payment failed",
    expired: "Unpaid booking hold expired",
    completed: "Rental marked complete",
  };
  return {
    subject: `${titles[mail.kind]} ${mail.reference}`,
    text: `${titles[mail.kind]}.\n\nCustomer: ${who}\n${lines}\n${mail.refundNote ? `\n${mail.refundNote}\n` : ""}`,
  };
};

export const sendBookingEmails = async (mail: BookingMail) => {
  const customer = customerCopy(mail);
  const office = officeCopy(mail);
  try {
    await sendMail({ to: mail.customerEmail, ...customer });
    if (OFFICE_EMAIL.toLowerCase() !== mail.customerEmail.toLowerCase()) {
      await sendMail({ to: OFFICE_EMAIL, ...office });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email failed";
    console.error(`Booking email failed for ${mail.reference}: ${message}`);
  }
};

export const sendPasswordResetEmail = async (input: {
  email: string;
  name: string;
  otp: number;
}) => {
  try {
    return await sendMail({
      to: input.email,
      subject: "Your TasDrive password reset code",
      text: `Hello ${input.name},\n\nYour TasDrive password reset code is ${input.otp}. It expires in 10 minutes.\n\nIf you did not ask for this, you can ignore this email.\n`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email failed";
    console.error(`Password reset email failed for ${input.email}: ${message}`);
    return false;
  }
};
