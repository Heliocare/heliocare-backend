import { z } from "zod";

export const sendMessageSchema = z.object({
  body: z.object({
    patientId: z.string().uuid("Invalid patient ID"),
    doctorId: z.string().uuid("Invalid doctor ID").optional(),
    content: z.string().min(1, "Message content cannot be empty").max(5000, "Message is too long"),
  }),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>["body"];
