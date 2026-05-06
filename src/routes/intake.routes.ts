import { Router } from "express";
import { IntakeController, intakeValidation } from "../controllers/intake.controller.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { verifyAccessToken, requireRole } from "../middleware/auth.js";

const router: import("express").Router = Router();

router.use(verifyAccessToken);

// Start
router.post(
    "/start",
    requireRole(["Patient"]),
    validateRequest(intakeValidation.startSchema),
    IntakeController.start
);

// Save step
router.put(
    "/:intakeId/step/:stepNumber",
    requireRole(["Patient"]), // Step specifics are dynamically validated or merged
    IntakeController.saveStep
);

// Submit
router.post(
    "/:intakeId/submit",
    requireRole(["Patient"]),
    IntakeController.submit
);

// GET
router.get(
    "/:intakeId",
    requireRole(["Patient", "Doctor", "Admin"]),
    IntakeController.get
);

// Unlock
router.put(
    "/:intakeId/unlock",
    requireRole(["Doctor"]),
    IntakeController.unlock
);

export default router;
