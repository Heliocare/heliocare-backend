import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { encryptObject, encryptString } from "../lib/crypto/fieldEncrypt.js";

const profileSchema = z.object({
    fullName: z.string().min(1),
    dob: z.string().min(1),
    address: z.object({
        street: z.string(),
        city: z.string(),
        zip: z.string()
    }),
    stateOfResidence: z.string(),
    marketingOptIn: z.boolean().default(false)
}).strict();

export const onboardingSchema = { profileSchema };

export const OnboardingController = {
    createProfile: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.id;

            const existing = await prisma.patient.findUnique({ where: { userId } });
            if (existing) {
                return sendError(res, "Patient profile already exists", "PROFILE_EXISTS", 409);
            }

            const { fullName, dob, address, stateOfResidence, marketingOptIn } = req.body;

            const patient = await prisma.patient.create({
                data: {
                    userId,
                    fullNameEnc: encryptString(fullName),
                    dobEnc: encryptString(dob),
                    addressEnc: encryptObject(address),
                    stateOfResidence,
                    marketingOptIn,
                    accountStatus: "PENDING_INTAKE"
                }
            });

            await prisma.auditLog.create({
                data: {
                    action: "PATIENT_PROFILE_CREATED",
                    userId,
                    entityId: patient.id
                }
            });

            sendSuccess(res, { patientId: patient.id }, 201);
        } catch (e) {
            next(e);
        }
    }
};
