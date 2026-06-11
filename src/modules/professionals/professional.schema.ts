import { z } from "zod";
import { DeactivationReason } from "../../generated/prisma/index.js";

const dayEnum = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

const timeSlotSchema = z.object({
  day: dayEnum,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
});

const availabilitySchema = z.array(timeSlotSchema).min(1, "At least one time slot is required");

export const professionalSchema = {
  completeProfile: z.object({
    fullName: z.string().min(1, "Full name is required"),
    registrationNum: z.string().min(1, "Registration number is required"),
    specialisation: z.string().optional(),
    availability: z.string().optional(),
  }),

  updateAvailability: z.object({
    availability: availabilitySchema,
    maxOpenConsults: z.number().int().min(1).max(100).optional(),
  }),

  updateProfile: z.object({
    fullName: z.string().min(1).optional(),
    specialisation: z.string().optional(),
    registrationNum: z.string().min(1).optional(),
  }),

  suspend: z.object({
    reason: z.string().min(10, "Suspension reason must be at least 10 characters"),
  }),

  deactivate: z.object({
    reason: z.nativeEnum(DeactivationReason),
  }),

  reassignPatients: z.object({
    fromProfessionalId: z.string().uuid(),
    toProfessionalId: z.string().uuid(),
    reason: z.string().min(10, "Reassignment reason must be at least 10 characters"),
  }),

  listQuery: z.object({
    status: z.string().optional(),
    regBody: z.string().optional(),
    role: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};
