import { Router } from "express";
import { OnboardingController, onboardingSchema } from "../controllers/onboarding.controller.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { verifyAccessToken, requireRole } from "../middleware/auth.js";

const router: import("express").Router = Router();

router.use(verifyAccessToken); // Mock middleware verifying existence 

router.post(
    "/profile",
    requireRole(["Patient"]),
    validateRequest(onboardingSchema.profileSchema),
    OnboardingController.createProfile
);

export default router;
