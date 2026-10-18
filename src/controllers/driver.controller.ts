import type { RequestHandler } from "express";
import * as driverService from "../services/driver.service.js";

export const createDriver: RequestHandler = async (req, res, next) => {
  try {
    const driver = await driverService.createDriver(req.body);

    res.status(201).json({
      success: true,
      message: "Driver added successfully",
      data: driver,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllDrivers: RequestHandler = async (req, res, next) => {
  try {
    const result = await driverService.getAllDrivers(req.query);

    res.status(200).json({
      success: true,
      data: result.drivers,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getDriverById: RequestHandler = async (req, res, next) => {
  try {
    const driver = await driverService.getDriverById(req.params.id as string);

    res.status(200).json({
      success: true,
      data: driver,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDriver: RequestHandler = async (req, res, next) => {
  try {
    const driver = await driverService.updateDriver(
      req.params.id as string,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Driver updated successfully",
      data: driver,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDriver: RequestHandler = async (req, res, next) => {
  try {
    const result = await driverService.deleteDriver(req.params.id as string);

    res.status(200).json({
      success: true,
      message: "Driver removed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
