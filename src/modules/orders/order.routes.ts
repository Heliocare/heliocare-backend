import { Router, type IRouter } from "express";
import { OrderController } from "./order.controller.js";
import { AuthMiddleware } from "../../middleware/protect.js";

const router: IRouter = Router();
const controller = new OrderController();

router.use(AuthMiddleware.protect);

// Create order
router.post("/", AuthMiddleware.restrictTo("DOCTOR", "ADMIN", "SUPER_ADMIN"), controller.create);

// Transition order status
router.patch(
  "/:id/status",
  AuthMiddleware.restrictTo("PHARMACY", "PHARMACIST", "ADMIN", "SUPER_ADMIN"),
  controller.transitionStatus
);

// Get order by ID
router.get("/:id", controller.getById);

// Get all orders with filters
router.get("/", controller.list);

export default router;
