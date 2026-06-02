import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { Crypto } from "../../utils/crypto.js";

export class OnboardingController {
  // Creates a patient profile linked to the authenticated user.
  async createProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      // 1. Ensure profile exists (created during registration)
      const existing = await prisma.patient.findUnique({ where: { userId } });
      if (!existing) {
        throw new AppError("Patient profile not found. Please register properly.", 404);
      }

      const { firstName, lastName, gender, dob, address, stateOfResidence, marketingOptIn } = req.body;

      // 2. Update the patient record with onboarding details (plaintext + encrypted)
      const patient = await prisma.patient.update({
        where: { userId },
        data: {
          firstName,
          lastName,
          gender,
          dob: new Date(dob),
          address,
          stateOfResidence,
          marketingOptIn,
          accountStatus: "PENDING_INTAKE",
          // Dual-write encrypted PII fields
          firstNameEnc: Crypto.encrypt(firstName),
          lastNameEnc: Crypto.encrypt(lastName),
          genderEnc: Crypto.encrypt(gender),
          dobEnc: Crypto.encrypt(dob),
          addressEnc: Crypto.encrypt(address),
          stateOfResidenceEnc: Crypto.encrypt(stateOfResidence),
        },
      });

      // 3. Log the event
      await prisma.auditLog.create({
        data: {
          action: "PATIENT_PROFILE_COMPLETED",
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
