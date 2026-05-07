import { Router, type IRouter } from "express";
import { MessageController } from "./message.controller.js";
import { AuthMiddleware } from "../../middleware/protect.js";

const router: IRouter = Router();
const messageController = new MessageController();

// All message routes are protected
router.use(AuthMiddleware.protect);

router.get("/history/:patientId", messageController.getHistory);
router.post("/read", messageController.markAsRead);

export default router;
