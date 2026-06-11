import { Router, type IRouter } from "express";
import { TreatmentPlanController } from "./treatment.controller.js";
import { AuthMiddleware } from "../../middleware/protect.js";

const router: IRouter = Router();
const controller = new TreatmentPlanController();

router.use(AuthMiddleware.protect);

// ── Create & Update ────────────────────────────────────────────

router.post(
  "/",
  AuthMiddleware.restrictTo("DOCTOR", "ADMIN", "SUPER_ADMIN"),
  controller.create
);

router.put(
  "/:id",
  AuthMiddleware.restrictTo("DOCTOR", "ADMIN", "SUPER_ADMIN"),
  controller.update
);

// ── Read ───────────────────────────────────────────────────────

router.get("/patient/:patientId", controller.listByPatient);

router.get("/:id/history", controller.getHistory);

router.get("/:id", controller.getLatest);

// ── Referral ───────────────────────────────────────────────────

router.patch(
  "/:id/refer-dietitian",
  AuthMiddleware.restrictTo("DOCTOR", "ADMIN", "SUPER_ADMIN"),
  controller.referDietitian
);

// ── Lab Annotation ─────────────────────────────────────────────

router.patch(
  "/lab-results/:resultId/annotate",
  AuthMiddleware.restrictTo("DOCTOR", "ADMIN", "SUPER_ADMIN"),
  controller.annotateLabResult
);

export default router;
