import { z } from "zod";

export const patientSchema = {
  getProfileQuery: z.object({
    patientId: z.string().uuid("Invalid patient ID format"),
  }),

  updateProfile: z.object({
    firstName: z.string().min(1, "First name must not be empty").optional(),
    lastName: z.string().min(1, "Last name must not be empty").optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "NOT_SPECIFIED"]).optional(),
    dob: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format")
      .optional(),
    address: z.string().min(5, "Address must be at least 5 characters").optional(),
    stateOfResidence: z.string().min(1, "State of residence must not be empty").optional(),
    marketingOptIn: z.boolean().optional(),
  }),

  correctData: z.object({
    corrections: z
      .record(z.string(), z.unknown())
      .refine(
        (obj) => Object.keys(obj).length > 0,
        "At least one correction is required"
      ),
    reason: z.string().min(10, "Reason must be at least 10 characters"),
  }),
};
