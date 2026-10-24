import { Router } from "express";
import { getPaymentConfig } from "../controllers/payment.controller.js";

const router = Router();

router.get("/config", getPaymentConfig);

export default router;
