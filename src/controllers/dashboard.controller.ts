import type { Request, Response } from "express";
import { getAdminDashboard } from "../services/dashboard.service.js";

export const getDashboard = async (_req: Request, res: Response) => {
  try {
    const data = await getAdminDashboard();
    res.status(200).json({
      success: true,
      message: "Admin dashboard retrieved successfully",
      data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve admin dashboard",
    });
  }
};
