import { Router, type IRouter } from "express";
import { AuthController } from "./auth.controller.js";
import { ErrorMiddleware } from "../../middleware/errorHandler.js";
import { AuthMiddleware } from "../../middleware/protect.js";
import { registerSchema, loginSchema, activateSchema } from "./auth.schema.js";

const router: IRouter = Router();
const authController = new AuthController();

router.post(
  "/register",
  ErrorMiddleware.validate(registerSchema),
  authController.register
);

router.post(
  "/login",
  ErrorMiddleware.validate(loginSchema),
  authController.login
);

router.post(
  "/activate",
  ErrorMiddleware.validate(activateSchema),
  authController.activate
);

// Email Verification
router.post("/verify-email/:token", authController.verifyEmail);

router.post("/resend-verification", AuthMiddleware.protect, authController.resendVerification);

// Password Reset
router.post("/forgot-password", authController.forgotPassword);

router.post("/reset-password/:token", authController.resetPassword);

// Session Management
router.post("/refresh", authController.refresh);

router.post("/logout", authController.logout);

// Data Rights (NDPR Compliance)
router.get("/me/export", AuthMiddleware.protect, authController.exportMe);

router.delete("/me/deletion", AuthMiddleware.protect, authController.deleteMe);

// Multi-Factor Authentication (MFA)
router.post("/mfa/setup", AuthMiddleware.protect, authController.setupMfa);
router.post("/mfa/enable", AuthMiddleware.protect, authController.verifyAndEnableMfa);

// Account Lock Management
router.post("/unlock/request", authController.requestUnlock);

router.post("/unlock/verify/:token", authController.unlockAccount);

export default router;
