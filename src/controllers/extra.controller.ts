import type { RequestHandler } from "express";
import * as extraService from "../services/extra.service.js";

export const createExtra: RequestHandler = async (req, res, next) => {
  try {
    const extra = await extraService.createExtra(req.body);

    res.status(201).json({
      success: true,
      message: "Extra added successfully",
      data: extra,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllExtras: RequestHandler = async (_req, res, next) => {
  try {
    const extras = await extraService.getAllExtras();

    res.status(200).json({
      success: true,
      data: extras,
    });
  } catch (error) {
    next(error);
  }
};

export const getExtraById: RequestHandler = async (req, res, next) => {
  try {
    const extra = await extraService.getExtraById(req.params.id as string);

    res.status(200).json({
      success: true,
      data: extra,
    });
  } catch (error) {
    next(error);
  }
};

export const updateExtra: RequestHandler = async (req, res, next) => {
  try {
    const extra = await extraService.updateExtra(
      req.params.id as string,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Extra updated successfully",
      data: extra,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteExtra: RequestHandler = async (req, res, next) => {
  try {
    const result = await extraService.deleteExtra(req.params.id as string);

    res.status(200).json({
      success: true,
      message: result.removed
        ? "Extra deleted successfully"
        : "Extra removed from the booking list. Existing bookings still keep it.",
      data: result.extra,
    });
  } catch (error) {
    next(error);
  }
};
