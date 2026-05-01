import { Router, type IRouter } from "express";
import { AdminController } from "./admin.controller.js";
import { AuthMiddleware } from "../../middleware/protect.js";

const router: IRouter = Router();
const adminController = new AdminController();

router.use(AuthMiddleware.protect, AuthMiddleware.restrictTo("ADMIN", "SUPER_ADMIN"));

router.post("/invite", adminController.inviteUser);

export default router;
