import { Router, type IRouter } from "express";
import { IntakeController } from "./intake.controller.js";
import { intakeSchema } from "./intake.schema.js";
import { AuthMiddleware } from "../../middleware/protect.js";
import { ErrorMiddleware } from "../../middleware/errorHandler.js";

const router: IRouter = Router();
const intakeController = new IntakeController();

// All intake routes require authentication
router.use(AuthMiddleware.protect);

router.post(
  "/start",
  ErrorMiddleware.validate(intakeSchema.start),
  intakeController.start
);

router.post(
  "/:intakeId/step/:stepNumber",
  ErrorMiddleware.validate(intakeSchema.saveStep),
  intakeController.saveStep
);

router.post(
  "/:intakeId/submit",
  intakeController.submit
);

router.post(
  "/:intakeId/unlock",
  AuthMiddleware.restrictTo("DOCTOR", "ADMIN", "SUPER_ADMIN"),
  AuthMiddleware.requireMfa,
  intakeController.unlock
);

export default router;
