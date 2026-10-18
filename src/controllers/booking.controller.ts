import type { Request, Response } from "express";
import * as bookingService from "../services/booking.service.js";

export const getExtras = async (_req: Request, res: Response) => {
  try {
    const data = await bookingService.getAvailableExtras();
    res.status(200).json({
      success: true,
      message: "Extras and pricing rules fetched successfully",
      data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch extras",
    });
  }
};

export const estimateBooking = async (req: Request, res: Response) => {
  try {
    const data = await bookingService.estimateBookingPrice(req.body);
    res.status(200).json({
      success: true,
      message: "Booking estimate calculated successfully",
      data,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to calculate booking estimate",
    });
  }
};

export const createBooking = async (req: Request, res: Response) => {
  try {
    const authenticatedUserId = req.userId;
    const booking = await bookingService.createBooking(req.body, authenticatedUserId);

    res.status(201).json({
      success: true,
      message: booking.isActive
        ? "Booking confirmed. Payment will be collected at the desk."
        : "Booking saved. Complete payment to activate it.",
      data: booking,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create booking",
    });
  }
};

export const getMyBookings = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required to view your bookings",
      });
      return;
    }

    const { bookings, pagination } = await bookingService.getUserBookings(
      req.userId,
      req.query
    );

    res.status(200).json({
      success: true,
      message: "User bookings retrieved successfully",
      data: bookings,
      pagination,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve bookings",
    });
  }
};

export const getBooking = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const email = typeof req.query.email === "string" ? req.query.email : undefined;

    const booking = await bookingService.getBookingDetails(id, req.userId, email);

    res.status(200).json({
      success: true,
      message: "Booking details retrieved successfully",
      data: booking,
    });
  } catch (error: any) {
    const statusCode = error.message.includes("permission") ? 403 : 404;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Booking not found",
    });
  }
};

export const confirmPayment = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const email =
      typeof req.body?.email === "string" ? req.body.email : undefined;

    const booking = await bookingService.confirmBookingPayment(
      id,
      req.userId,
      email,
      req.body?.stripePaymentIntentId,
    );

    const payingAtDesk = booking.payments?.some(
      (payment: { paymentOption?: string; status?: string }) =>
        payment.paymentOption === "PAY_AT_DESK" && payment.status !== "COMPLETED",
    );

    res.status(200).json({
      success: true,
      message: payingAtDesk
        ? "Booking is already active. Payment will be collected at the desk."
        : "Payment successful. Booking is now active.",
      data: booking,
    });
  } catch (error: any) {
    const message = error.message || "Failed to confirm payment";
    const statusCode = message.includes("permission") || message.includes("email")
      ? 403
      : message.includes("not found")
        ? 404
        : 400;
    res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

export const getAdminBookingSummary = async (_req: Request, res: Response) => {
  try {
    const data = await bookingService.getAdminBookingSummary();
    res.status(200).json({
      success: true,
      message: "Booking summary retrieved successfully",
      data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve booking summary",
    });
  }
};

export const getAllBookingsForAdmin = async (req: Request, res: Response) => {
  try {
    const result = await bookingService.getAllBookingsForAdmin(req.query);
    res.status(200).json({
      success: true,
      message: "Bookings retrieved successfully",
      data: result.bookings,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve bookings",
    });
  }
};

export const getBookingForAdmin = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const booking = await bookingService.getBookingDetails(id, req.userId);
    res.status(200).json({
      success: true,
      message: "Booking details retrieved successfully",
      data: booking,
    });
  } catch (error: any) {
    const statusCode = error.message.includes("permission") ? 403 : 404;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Booking not found",
    });
  }
};

export const confirmBookingForAdmin = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const booking = await bookingService.confirmBookingPayment(id, req.userId);
    res.status(200).json({
      success: true,
      message: booking.isActive
        ? "Booking is active."
        : "Booking confirmed.",
      data: booking,
    });
  } catch (error: any) {
    const message = error.message || "Failed to confirm booking";
    const statusCode = message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({ success: false, message });
  }
};

export const completeBookingForAdmin = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const booking = await bookingService.completeBooking(id);
    res.status(200).json({
      success: true,
      message: "Booking completed.",
      data: booking,
    });
  } catch (error: any) {
    const message = error.message || "Failed to complete booking";
    const statusCode = message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({ success: false, message });
  }
};

export const collectDeskPayment = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const booking = await bookingService.collectDeskPayment(id);
    res.status(200).json({
      success: true,
      message: "Desk payment collected.",
      data: booking,
    });
  } catch (error: any) {
    const message = error.message || "Failed to collect payment";
    const statusCode = message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({ success: false, message });
  }
};

export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { reason } = req.body || {};

    const result = await bookingService.cancelBooking(id, req.userId, reason);

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: result,
    });
  } catch (error: any) {
    const statusCode = error.message.includes("permission") ? 403 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to cancel booking",
    });
  }
};
