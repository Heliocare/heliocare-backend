import { Router, type IRouter } from "express";
import { ProfessionalController } from "./professional.controller.js";
import { AuthMiddleware } from "../../middleware/protect.js";

const router: IRouter = Router();
const controller = new ProfessionalController();

router.use(AuthMiddleware.protect);

// Professional self-service
router.patch(
  "/profile",
  AuthMiddleware.restrictTo("DOCTOR", "PHARMACIST", "LAB_SCIENTIST", "DIETITIAN"),
  controller.completeProfile
);

router.patch(
  "/availability",
  AuthMiddleware.restrictTo("DOCTOR", "DIETITIAN"),
  controller.updateAvailability
);

// Admin-only operations
router.patch(
  "/:id/suspend",
  AuthMiddleware.restrictTo("ADMIN", "SUPER_ADMIN"),
  controller.suspend
);

router.patch(
  "/:id/deactivate",
  AuthMiddleware.restrictTo("ADMIN", "SUPER_ADMIN"),
  controller.deactivate
);

router.post(
  "/reassign",
  AuthMiddleware.restrictTo("ADMIN", "SUPER_ADMIN"),
  controller.reassignPatients
);

// Read operations
router.get("/", controller.list);
router.get("/:id", controller.getById);

export default router;
