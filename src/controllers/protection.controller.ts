import type { RequestHandler } from "express";
import * as protectionService from "../services/protection.service.js";

export const createProtection: RequestHandler = async (req, res, next) => {
  try {
    const protection = await protectionService.createProtection(req.body);

    res.status(201).json({
      success: true,
      message: "Protection added successfully",
      data: protection,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllProtections: RequestHandler = async (_req, res, next) => {
  try {
    const protections = await protectionService.getAllProtections();

    res.status(200).json({
      success: true,
      data: protections,
    });
  } catch (error) {
    next(error);
  }
};

export const getProtectionById: RequestHandler = async (req, res, next) => {
  try {
    const protection = await protectionService.getProtectionById(
      req.params.id as string,
    );

    res.status(200).json({
      success: true,
      data: protection,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProtection: RequestHandler = async (req, res, next) => {
  try {
    const protection = await protectionService.updateProtection(
      req.params.id as string,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Protection updated successfully",
      data: protection,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProtection: RequestHandler = async (req, res, next) => {
  try {
    const result = await protectionService.deleteProtection(
      req.params.id as string,
    );

    res.status(200).json({
      success: true,
      message: result.removed
        ? "Protection deleted successfully"
        : "Protection removed from the booking list. Existing bookings still keep it.",
      data: result.protection,
    });
  } catch (error) {
    next(error);
  }
};
