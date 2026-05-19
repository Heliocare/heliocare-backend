import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { Crypto } from "../../utils/crypto.js";
import { evaluateExclusions } from "../../lib/clinical/exclusions.js";

export class IntakeController {
  // Initialize a new medical intake session.
  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vertical } = req.body;
      const userId = req.user!.id;

      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (!patient) {
        throw new AppError("Patient profile required before starting intake", 404);
      }

      // Check for existing active intake
      const activeIntake = await prisma.intake.findFirst({
        where: { patientId: patient.id, vertical, status: { not: "reviewed" } },
      });
      if (activeIntake) {
        throw new AppError("You already have an active intake for this vertical", 409);
      }

      const intake = await prisma.intake.create({
        data: {
          patientId: patient.id,
          vertical,
          formVersion: "1.0.0",
          responsesEnc: Crypto.encrypt(JSON.stringify({})),
          clinicalFlags: "[]",
          eligibility: "PENDING",
          status: "draft",
        },
      });

      res.status(201).json({
        status: "success",
        data: {
          intakeId: intake.id,
          vertical,
          currentStep: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Save a step's worth of responses (with E2E encryption).
  async saveStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const intakeId = req.params.intakeId as string;
      const stepResponses = req.body;

      const intake = await prisma.intake.findUnique({ where: { id: intakeId } });
      if (!intake) throw new AppError("Intake not found", 404);

      // Authorization check
      const patient = await prisma.patient.findUnique({ where: { id: intake.patientId } });
      if (!patient || patient.userId !== req.user!.id) {
        throw new AppError("Not authorized to modify this intake", 403);
      }
      if (intake.status !== "draft") {
        throw new AppError("Intake is already submitted and locked", 403);
      }

      // Decrypt, update, and re-encrypt responses
      const currentResponses = JSON.parse(Crypto.decrypt(intake.responsesEnc));
      const updatedResponses = { ...currentResponses, ...stepResponses };

      // Evaluate clinical exclusions (real-time feedback)
      const { hardExclusions, softExclusions } = evaluateExclusions(intake.vertical as any, updatedResponses);
      const allFlags = [...hardExclusions, ...softExclusions];

      await prisma.intake.update({
        where: { id: intake.id },
        data: {
          responsesEnc: Crypto.encrypt(JSON.stringify(updatedResponses)),
          clinicalFlags: JSON.stringify(allFlags),
        },
      });

      res.status(200).json({
        status: "success",
        data: {
          intakeId: intake.id,
          flags: allFlags,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Finalize and submit the intake for clinical review.
  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const intakeId = req.params.intakeId as string;
      const intake = await prisma.intake.findUnique({ where: { id: intakeId } });
      if (!intake) throw new AppError("Intake not found", 404);

      const patient = await prisma.patient.findUnique({ where: { id: intake.patientId } });
      if (!patient || patient.userId !== req.user!.id) {
        throw new AppError("Not authorized", 403);
      }

      const responses = JSON.parse(Crypto.decrypt(intake.responsesEnc));
      const { hardExclusions } = evaluateExclusions(intake.vertical as any, responses);

      const eligibility = hardExclusions.length > 0 ? "EXCLUDED" : "ELIGIBLE";
      const accountStatus = hardExclusions.length > 0 ? "INELIGIBLE" : "PENDING_CONSULT";

      await prisma.intake.update({
        where: { id: intake.id },
        data: {
          status: "submitted",
          eligibility: eligibility as any,
          submittedAt: new Date(),
        },
      });

      await prisma.patient.update({
        where: { id: intake.patientId },
        data: { accountStatus: accountStatus as any },
      });

      await prisma.auditLog.create({
        data: {
          action: "INTAKE_SUBMITTED",
          userId: req.user!.id,
          entityType: "Intake",
          entityId: intake.id,
        },
      });

      res.status(200).json({
        status: "success",
        data: {
          eligibility,
          message: eligibility === "ELIGIBLE"
            ? "Your intake has been submitted for doctor review."
            : "Based on your responses, you are currently ineligible for this treatment.",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Unlock a submitted intake for the patient to make corrections.
  async unlock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const intakeId = req.params.intakeId as string;
      const intake = await prisma.intake.findUnique({ where: { id: intakeId } });

      if (!intake) throw new AppError("Intake not found", 404);
      if (intake.status === "draft") throw new AppError("Intake is already unlocked", 400);

      // Reset to draft
      await prisma.intake.update({
        where: { id: intake.id },
        data: {
          status: "draft",
          eligibility: "PENDING",
        },
      });

      // Update patient account status back to PENDING_INTAKE
      await prisma.patient.update({
        where: { id: intake.patientId },
        data: { accountStatus: "PENDING_INTAKE" },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          action: "INTAKE_UNLOCKED",
          userId: req.user!.id,
          entityType: "Intake",
          entityId: intake.id,
          metadata: JSON.stringify({ reason: "Doctor requested corrections" }),
        },
      });

      res.status(200).json({
        status: "success",
        message: "Intake has been unlocked. The patient can now make corrections.",
      });
    } catch (error) {
      next(error);
    }
  }
}
