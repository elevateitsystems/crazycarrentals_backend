import { Router } from "express";
import { getDashboard } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { adminOnly } from "../middlewares/adminOnly.js";

const router = Router();

router.get("/dashboard", authenticate, adminOnly, getDashboard);

export default router;
