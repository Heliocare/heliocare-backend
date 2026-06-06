import { z } from "zod";

export const treatmentPlanSchema = {
  create: z.object({
    patientId: z.string().uuid("Invalid patient ID format"),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    startDate: z.string().datetime("Invalid start date format").optional(),
    endDate: z.string().datetime("Invalid end date format").optional(),
  }),

  update: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    startDate: z.string().datetime("Invalid start date format").optional(),
    endDate: z.string().datetime("Invalid end date format").optional(),
  }),

  referDietitian: z.object({
    dietitianReferralStatus: z.enum([
      "NOT_REFERRED",
      "PENDING",
      "REFERRED",
      "ACCEPTED",
      "DECLINED",
    ]),
    dietitianReferralNote: z.string().min(1).optional(),
  }),

  annotateLabResult: z.object({
    annotation: z.string().min(1, "Annotation must not be empty"),
  }),
};
