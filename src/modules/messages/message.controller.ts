import type { Request, Response, NextFunction } from "express";
import { MessageService } from "./message.service.js";
import { AppError } from "../../utils/AppError.js";

const messageService = new MessageService();

export class MessageController {
  // Get chat history for a specific conversation
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId } = req.params;
      if (!patientId || typeof patientId !== "string") {
        throw new AppError("Patient ID is required and must be a string", 400);
      }

      // Security: Only the patient themselves or a doctor can view the history
      const user = req.user!;
      if (user.role === "PATIENT" && user.id !== patientId) {
        throw new AppError("You can only view your own messages", 403);
      }

      const history = await messageService.getConversationHistory(patientId);

      res.status(200).json({
        status: "success",
        data: {
          messages: history,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Mark messages in a conversation as read
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId, doctorId } = req.body;
      if (!patientId || !doctorId) {
        throw new AppError("Patient ID and Doctor ID are required", 400);
      }

      await messageService.markAsRead(patientId, doctorId, req.user!.role as "PATIENT" | "DOCTOR");

      res.status(200).json({
        status: "success",
        message: "Messages marked as read",
      });
    } catch (error) {
      next(error);
    }
  }
}
