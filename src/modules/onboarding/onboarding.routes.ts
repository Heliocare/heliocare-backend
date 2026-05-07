import { Router, type IRouter } from "express";
import { OnboardingController } from "./onboarding.controller.js";
import { onboardingSchema } from "./onboarding.schema.js";
import { AuthMiddleware } from "../../middleware/protect.js";
import { ErrorMiddleware } from "../../middleware/errorHandler.js";

const router: IRouter = Router();
const onboardingController = new OnboardingController();

// All onboarding routes require a logged-in user
router.use(AuthMiddleware.protect);

router.post(
  "/profile",
  ErrorMiddleware.validate(onboardingSchema),
  onboardingController.createProfile
);

export default router;
