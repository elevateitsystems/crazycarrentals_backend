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
      message: "Booking created successfully",
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
