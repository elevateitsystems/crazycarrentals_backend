import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

export const adminOnly: RequestHandler = async (req, res, next) => {
  try {
    let userId = req.userId || req.body?.userId;

    // Automatically inspect Authorization Bearer token if userId is not directly set
    if (!userId && req.headers.authorization) {
      const [scheme, token] = req.headers.authorization.split(" ") ?? [];
      if (scheme === "Bearer" && token) {
        try {
          const payload = jwt.verify(token, env.JWT_SECRET);
          if (typeof payload !== "string" && typeof payload.sub === "string") {
            userId = payload.sub;
            req.userId = userId;
          }
        } catch {
          res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token",
          });
          return;
        }
      }
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required: Please provide 'Authorization: Bearer <token>' header or 'userId' in request body",
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      res.status(403).json({
        success: false,
        message:
          "You are not authorized to perform this action. Admin role required.",
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
