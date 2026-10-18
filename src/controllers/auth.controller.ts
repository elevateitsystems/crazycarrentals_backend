
import type { RequestHandler } from 'express';
import * as authService from '../services/auth.service.js';
import { extractSingleFile } from '../middlewares/upload.middleware.js';

export const register: RequestHandler = async (req, res) => {
  const result = await authService.register(req.body);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: result,
  });
};

export const login: RequestHandler = async (req, res) => {
  const result = await authService.login(req.body);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: result,
  });
};

export const profile: RequestHandler = async (req, res) => {
  const user = await authService.getProfile(req.userId!);

  res.status(200).json({
    success: true,
    data: user,
  });
};

export const forgetPassword: RequestHandler = async (req, res) => {

    const result = await authService.forgetPassword(req.body);
    res.status(200).json({
        success: true,
        message: 'Password reset OTP sent successfully',
        data: result,
    });
};

export const resetPassword: RequestHandler = async (req, res) => {

    const result = await authService.resetPassword(req.body);
    res.status(200).json({
        success: true,
        message: 'Password reset successfully',
    });
};

export const changePassword: RequestHandler = async (req, res) => {

    const result = await authService.changePassword(req.userId!, req.body);

    res.status(200).json({
        success: true,
        message: 'Password changed successfully',
    });
};

export const updateProfile: RequestHandler = async (req, res, next) => {
    try {
        const file = extractSingleFile(req);
        const updatedUser = await authService.updateProfile(req.userId!, req.body, file);

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser,
        });
    } catch (error) {
        next(error);
    }
};  


// Admin side

export const getAllUsers: RequestHandler = async (req, res, next) => {
    try {
        const result = await authService.getAllUsers(req.query);

        res.status(200).json({
            success: true,
            data: result.users,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
};  

export const getUserById: RequestHandler = async (req, res, next) => {
    try {
        const user = await authService.getUserById(req.params.id as string);

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

export const updateUserById: RequestHandler = async (req, res, next) => {
    try {
        const user = await authService.updateUserById(req.params.id as string, req.body);

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteUserById: RequestHandler = async (req, res, next) => {
    try {
        await authService.deleteUserById(req.params.id as string, req.userId);

        res.status(200).json({
            success: true,
            message: 'User deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};