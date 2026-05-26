import { Router, type IRouter } from "express";
import { PrescriptionController } from "./prescription.controller.js";
import { AuthMiddleware } from "../../middleware/protect.js";

const router: IRouter = Router();
const controller = new PrescriptionController();

// All prescription routes require user login
router.use(AuthMiddleware.protect);

router.post("/", AuthMiddleware.restrictTo("DOCTOR"), controller.issue);
router.get("/:id/pdf", controller.getPdf);
router.post(
  "/:id/cancel",
  AuthMiddleware.restrictTo("DOCTOR", "ADMIN", "SUPER_ADMIN"),
  controller.cancel
);

export default router;
