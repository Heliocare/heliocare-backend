import { z } from "zod";

export const prescriptionSchema = {
  issue: z.object({
    patientId: z.string().uuid("Invalid patient ID format"),
    subscriptionId: z.string().uuid("Invalid subscription ID format"),
    drugName: z.string().min(1, "Drug name is required"),
    doseMg: z.number().positive("Dose must be a positive number"),
    frequency: z.string().min(1, "Frequency is required"),
    quantity: z.number().int().positive("Quantity must be a positive integer"),
    expiresAt: z.string().datetime("Invalid expiration date format"),
    previousPrescriptionId: z.string().uuid("Invalid previous prescription ID format").optional(),
  }),

  cancel: z.object({
    reason: z.string().min(10, "Cancellation reason must be at least 10 characters long"),
  }),
};
