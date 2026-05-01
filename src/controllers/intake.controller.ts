import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { encryptObject, decryptObject } from "../lib/crypto/fieldEncrypt.js";
import { evaluateExclusions } from "../lib/clinical/exclusions.js";

const startSchema = z.object({
    vertical: z.enum(["ED", "WEIGHT_LOSS"])
}).strict();

export const intakeValidation = { startSchema };

export const IntakeController = {
    start: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { vertical } = req.body;
            const patient = await prisma.patient.findUnique({ where: { userId: req.user!.id } });
            if (!patient) { sendError(res, "Patient profile required", "NOT_FOUND", 404); return; }

            const activeIntake = await prisma.intake.findFirst({
                where: { patientId: patient.id, vertical, status: { not: "reviewed" } }
            });
            if (activeIntake) { sendError(res, "Active intake already exists", "INTAKE_EXISTS", 409); return; }

            const intake = await prisma.intake.create({
                data: {
                    patientId: patient.id,
                    vertical,
                    formVersion: "1.0.0",
                    responsesEnc: encryptObject({}),
                    clinicalFlags: [],
                    eligibility: "PENDING",
                    status: "draft"
                }
            });

            sendSuccess(res, { intakeId: intake.id, vertical, formVersion: intake.formVersion, currentStep: 0 }, 201);
        } catch (e) { next(e); }
    },

    saveStep: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const intakeId = req.params["intakeId"] as string;
            const stepNumber = req.params["stepNumber"] as string;
            const stepResponses = req.body;

            const intake = await prisma.intake.findUnique({ where: { id: intakeId } });
            if (!intake) { sendError(res, "Intake not found", "NOT_FOUND", 404); return; }

            // Verify ownership via patient
            const patient = await prisma.patient.findUnique({ where: { id: intake.patientId } });
            if (!patient || patient.userId !== req.user!.id) { sendError(res, "Forbidden", "FORBIDDEN", 403); return; }
            if (intake.status !== "draft") { sendError(res, "Intake locked", "LOCKED", 403); return; }

            let responses = decryptObject(intake.responsesEnc);
            responses = { ...responses, ...stepResponses };

            const { hardExclusions, softExclusions } = evaluateExclusions(intake.vertical as any, responses);
            const allFlags = [...hardExclusions, ...softExclusions];

            await prisma.intake.update({
                where: { id: intake.id },
                data: { responsesEnc: encryptObject(responses), clinicalFlags: allFlags }
            });

            sendSuccess(res, { intakeId: intake.id, stepSaved: parseInt(stepNumber), nextStep: parseInt(stepNumber) + 1, exclusions: allFlags });
        } catch (e) { next(e); }
    },

    submit: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const intakeId = req.params["intakeId"] as string;
            const intake = await prisma.intake.findUnique({ where: { id: intakeId } });
            if (!intake) { sendError(res, "Intake not found", "NOT_FOUND", 404); return; }

            const patient = await prisma.patient.findUnique({ where: { id: intake.patientId } });
            if (!patient || patient.userId !== req.user!.id) { sendError(res, "Forbidden", "FORBIDDEN", 403); return; }
            if (intake.status !== "draft") { sendError(res, "Intake locked", "LOCKED", 403); return; }

            const responses = decryptObject(intake.responsesEnc);
            const { hardExclusions, softExclusions } = evaluateExclusions(intake.vertical as any, responses);
            const allFlags = [...hardExclusions, ...softExclusions];

            const eligibility = hardExclusions.length > 0 ? "EXCLUDED" : "ELIGIBLE";
            const accountStatus = hardExclusions.length > 0 ? "INELIGIBLE" : "PENDING_CONSULT";

            await prisma.intake.update({
                where: { id: intake.id },
                data: { status: "submitted", eligibility: eligibility as any, clinicalFlags: allFlags, submittedAt: new Date() }
            });

            await prisma.patient.update({
                where: { id: intake.patientId },
                data: { accountStatus: accountStatus as any }
            });

            await prisma.auditLog.create({
                data: { action: "INTAKE_SUBMITTED", userId: req.user!.id, entityId: intake.id }
            });

            sendSuccess(res, { eligibility, exclusionCodes: allFlags });
        } catch (e) { next(e); }
    },

    get: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const intakeId = req.params["intakeId"] as string;
            const intake = await prisma.intake.findUnique({ where: { id: intakeId } });
            if (!intake) { sendError(res, "Intake not found", "NOT_FOUND", 404); return; }

            const patient = await prisma.patient.findUnique({ where: { id: intake.patientId } });
            if (!patient) { sendError(res, "Patient not found", "NOT_FOUND", 404); return; }

            const isPatient = req.user!.role === "Patient";
            const isDoctor = req.user!.role === "Doctor";
            if (isPatient && patient.userId !== req.user!.id) { sendError(res, "Forbidden", "FORBIDDEN", 403); return; }

            let responses = decryptObject(intake.responsesEnc);

            if (isDoctor) {
                if (responses.personalDetails) {
                    responses.personalDetails.ssn = "[REDACTED]";
                    responses.personalDetails.dob = "[REDACTED]";
                }
            }

            sendSuccess(res, {
                ...intake,
                responsesEnc: undefined,
                responses,
                patient: {
                    id: patient.id,
                    stateOfResidence: patient.stateOfResidence,
                    accountStatus: patient.accountStatus,
                    marketingOptIn: patient.marketingOptIn
                }
            });
        } catch (e) { next(e); }
    },

    unlock: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const intakeId = req.params["intakeId"] as string;
            const intake = await prisma.intake.findUnique({ where: { id: intakeId } });
            if (!intake) { sendError(res, "Intake not found", "NOT_FOUND", 404); return; }

            await prisma.intake.update({
                where: { id: intake.id },
                data: { status: "draft", eligibility: "PENDING" }
            });

            await prisma.auditLog.create({
                data: { action: "INTAKE_UNLOCKED", userId: req.user!.id, entityId: intake.id }
            });

            sendSuccess(res, { unlocked: true });
        } catch (e) { next(e); }
    }
};
