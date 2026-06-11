import type { Request, Response, NextFunction } from "express";
import { OrderService } from "./order.service.js";
import { orderSchema } from "./order.schema.js";

const orderService = new OrderService();

export class OrderController {
  // Creates a new order
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = orderSchema.create.parse(req.body);
      const result = await orderService.createOrder(parsedBody);
      res.status(201).json({
        status: "success",
        message: "Order created successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Transitions the status of an order
  async transitionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = orderSchema.transitionStatus.parse(req.body);
      const result = await orderService.transitionStatus(
        req.params.id as string,
        parsedBody.status,
        req.user!.id,
        parsedBody
      );
      res.status(200).json({
        status: "success",
        message: `Order status transitioned to ${parsedBody.status}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Gets an order by ID
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await orderService.getOrderById(req.params.id as string);
      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Lists orders with filters
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedQuery = orderSchema.listQuery.parse(req.query);
      const result = await orderService.listOrders(parsedQuery, req.user!);
      res.status(200).json({
        status: "success",
        data: result.orders,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
