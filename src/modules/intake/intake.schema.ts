import { z } from "zod";

export const intakeSchema = {
  start: z.object({
    body: z.object({
      vertical: z.enum(["ED", "WEIGHT_LOSS"]),
    }),
  }),
  saveStep: z.object({
    params: z.object({
      intakeId: z.string().uuid("Invalid Intake ID format"),
      stepNumber: z.string().min(1, "Step number is required"),
    }),
    body: z.record(z.string(), z.any()), // Accepts flexible JSON responses for different steps
  }),
  submit: z.object({
    params: z.object({
      intakeId: z.string().uuid("Invalid Intake ID format"),
    }),
  }),
};

export type IntakeStartInput = z.infer<typeof intakeSchema.start>["body"];
