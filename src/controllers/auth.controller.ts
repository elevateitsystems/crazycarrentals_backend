
import type { RequestHandler } from 'express';
import * as authService from '../services/auth.service.js';

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

export const updateProfile: RequestHandler = async (req, res) => {
    const result = await authService.updateProfile(req.userId!, req.body);
    res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
    });
};  