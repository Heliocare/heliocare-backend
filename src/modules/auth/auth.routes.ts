import { Router, type IRouter } from "express";
import { AuthController } from "./auth.controller.js";
import { ErrorMiddleware } from "../../middleware/errorHandler.js";
import { AuthMiddleware } from "../../middleware/protect.js";
import { registerSchema, loginSchema } from "./auth.schema.js";

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

// Email Verification
router.post("/verify-email/:token", authController.verifyEmail);
router.post("/resend-verification", AuthMiddleware.protect, authController.resendVerification);

// Password Reset
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);

// Session Management
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

export default router;
