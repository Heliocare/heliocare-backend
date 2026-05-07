import { z } from "zod";

export const onboardingSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    address: z.string().min(5, "Full address is required"),
    stateOfResidence: z.string().min(1, "State is required"),
    marketingOptIn: z.boolean().default(false),
  }),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>["body"];
