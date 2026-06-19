import { Router } from "express";
import { LabController, labValidation } from "../controllers/lab.controller.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { verifyAccessToken, requireRole } from "../middleware/auth.js";

const router: import("express").Router = Router();

// Webhooks from Lab partners
router.post(
    "/webhook",
    validateRequest(labValidation.webhookSchema),
    LabController.processWebhook
);

router.use(verifyAccessToken);

// Create Lab Order
router.post(
    "/order",
    requireRole(["Doctor"]),
    validateRequest(labValidation.orderSchema),
    LabController.createOrder
);

// Get Patient Labs
router.get(
    "/patient/:patientId",
    requireRole(["Patient", "Doctor", "Admin"]),
    LabController.getPatientLabs
);

export default router;
