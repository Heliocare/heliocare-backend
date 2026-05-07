import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

export class OnboardingController {
  /**
   * Creates a patient profile linked to the authenticated user.
   */
  async createProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      // 1. Prevent duplicate profiles
      const existing = await prisma.patient.findUnique({ where: { userId } });
      if (existing) {
        throw new AppError("Patient profile already exists", 409);
      }

      const { firstName, lastName, gender, dob, address, stateOfResidence, marketingOptIn } = req.body;

      // 2. Create the patient record
      const patient = await prisma.patient.create({
        data: {
          userId,
          firstName,
          lastName,
          gender,
          dob: new Date(dob),
          address,
          stateOfResidence,
          marketingOptIn,
          accountStatus: "PENDING_INTAKE",
          ndprConsentAt: new Date(),
        },
      });

      // 3. Log the event
      await prisma.auditLog.create({
        data: {
          action: "PATIENT_PROFILE_CREATED",
          userId,
          entityType: "Patient",
          entityId: patient.id,
        },
      });

      res.status(201).json({
        status: "success",
        data: {
          patientId: patient.id,
          message: "Profile created successfully. Please proceed to Medical Intake.",
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
