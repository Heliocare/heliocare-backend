import { Router, type IRouter } from "express";
import { AuthController } from "./auth.controller.js";
import { ErrorMiddleware } from "../../middleware/errorHandler.js";
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

router.post(
  "/refresh",
  authController.refresh
);

router.post(
  "/logout",
  authController.logout
);

export default router;
