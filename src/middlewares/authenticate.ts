import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const authenticate: RequestHandler = (req, res, next) => {
  const authorization = req.headers.authorization;
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);

    if (typeof payload === "string" || typeof payload.sub !== "string") {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
      return;
    }

    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export const optionalAuthenticate: RequestHandler = (req, _res, next) => {
  const authorization = req.headers.authorization;
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme === "Bearer" && token) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (typeof payload !== "string" && typeof payload.sub === "string") {
        req.userId = payload.sub;
      }
    } catch {
      // Ignore invalid token in optional auth
    }
  }
  next();
};

