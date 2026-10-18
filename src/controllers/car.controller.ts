import type { RequestHandler } from 'express';
import * as carService from '../services/car.service.js';
import * as driverService from '../services/driver.service.js';

export const addNewCar: RequestHandler = async (req, res, next) => {
  try {
    const car = await carService.addNewCar(req);

    res.status(201).json({
      success: true,
      message: 'Car added successfully',
      data: car,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllCars: RequestHandler = async (req, res, next) => {
  try {
    const result = await carService.getAllCars(req.query);

    res.status(200).json({
      success: true,
      data: result.cars,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const searchCars: RequestHandler = async (req, res, next) => {
  try {
    const params = { ...req.query, ...req.body };
    const result = await carService.searchCars(params);

    res.status(200).json({
      success: true,
      message: 'Cars searched successfully',
      data: result.cars,
      pagination: result.pagination,
      searchCriteria: result.searchCriteria,
    });
  } catch (error) {
    next(error);
  }
};

export const getCarById: RequestHandler = async (req, res, next) => {
  try {
    const car = await carService.getCarById(req.params.id as string);

    res.status(200).json({
      success: true,
      data: car,
    });
  } catch (error) {
    next(error);
  }
};


export const updateCarById: RequestHandler = async (req, res, next) => {
    try {
        const car = await carService.updateCarById(req.params.id as string, req);

        res.status(200).json({
            success: true,
            message: 'Car updated successfully',
            data: car,
        });
    }catch(error){
        next(error);
    }
};


export const assignDriver: RequestHandler = async (req, res, next) => {
  try {
    const result = await driverService.assignDriverToCar(
      req.params.id as string,
      req.body.driverId,
    );

    res.status(200).json({
      success: true,
      message: req.body.driverId
        ? 'Driver assigned to car'
        : 'Driver removed from car',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCarById: RequestHandler = async (req, res, next) => {
    try{
        const car = await carService.deleteCarById(req.params.id as string);

        res.status(200).json({
            success: true,
            message: 'Car deleted successfully',
        });
    }catch(error){
        next(error);
    }
};
