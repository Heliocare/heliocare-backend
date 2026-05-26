import type { Request, Response, NextFunction } from "express";
import { PrescriptionService } from "./prescription.service.js";
import { prescriptionSchema } from "./prescription.schema.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

const prescriptionService = new PrescriptionService();

export class PrescriptionController {
  // Issues a new prescription or dose escalation
  async issue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = prescriptionSchema.issue.parse(req.body);

      // Resolve Doctor's professional profile from logged in user ID
      const doctorProfile = await prisma.professionalProfile.findUnique({
        where: { userId: req.user!.id },
      });

      if (!doctorProfile) {
        throw new AppError("Only verified clinical staff can issue prescriptions.", 403);
      }

      const result = await prescriptionService.issuePrescription(doctorProfile.id, parsedBody);

      res.status(201).json({
        status: "success",
        message: "Prescription issued successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Generates a 302 Found redirect to a temporary 15-minute signed S3 URL
  async getPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        throw new AppError("Invalid prescription ID.", 400);
      }
      const requestingUser = req.user!;

      const signedUrl = await prescriptionService.getSignedPdfUrl(id, requestingUser);

      // Perform a 302 Found redirect to the signed URL
      res.redirect(302, signedUrl);
    } catch (error) {
      next(error);
    }
  }

  // Cancels an active prescription with mandatory cancellation reason
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        throw new AppError("Invalid prescription ID.", 400);
      }
      const parsedBody = prescriptionSchema.cancel.parse(req.body);
      const cancellingUserId = req.user!.id;

      const result = await prescriptionService.cancelPrescription(
        id,
        cancellingUserId,
        parsedBody.reason
      );

      res.status(200).json({
        status: "success",
        message: "Prescription successfully cancelled",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
