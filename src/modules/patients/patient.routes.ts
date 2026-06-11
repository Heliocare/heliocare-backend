import { Router, type IRouter } from "express";
import { PatientController } from "./patient.controller.js";
import { AuthMiddleware } from "../../middleware/protect.js";

const router: IRouter = Router();
const controller = new PatientController();

router.use(AuthMiddleware.protect);


router.get("/me", controller.getProfile);

router.patch(
  "/me",
  AuthMiddleware.restrictTo("PATIENT"),
  controller.updateProfile
);

router.get(
  "/me/export",
  AuthMiddleware.restrictTo("PATIENT"),
  controller.exportData
);

router.delete(
  "/me",
  AuthMiddleware.restrictTo("PATIENT"),
  controller.requestDeletion
);

router.patch(
  "/me/correct",
  AuthMiddleware.restrictTo("PATIENT"),
  controller.correctData
);

router.get(
  "/:id",
  AuthMiddleware.restrictTo("DOCTOR", "DIETITIAN", "ADMIN", "SUPER_ADMIN"),
  controller.getProfile
);

export default router;
