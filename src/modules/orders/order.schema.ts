import { z } from "zod";

export const orderSchema = {
  create: z.object({
    patientId: z.string().uuid("Invalid patient ID format"),
    prescriptionId: z.string().uuid("Invalid prescription ID format"),
    subscriptionId: z.string().uuid("Invalid subscription ID format"),
    drugName: z.string().min(1, "Drug name is required"),
    patientStateOfResidence: z.string().min(1, "State of residence is required"),
    deliveryAddrEnc: z.string().optional(),
  }),

  transitionStatus: z
    .object({
      status: z.enum(["ACKNOWLEDGED", "PACKED", "DISPATCHED", "DELIVERED", "FAILED"]),
      trackingNumber: z.string().optional(),
      logisticsPartner: z.enum(["GIG", "KWIK", "SENDBOX", "OTHER"]).optional(),
      estDeliveryDate: z.string().datetime("Invalid delivery date format").optional(),
      pharmacyNotes: z.string().optional(),
    })
    .refine(
      (data) => {
        if (data.status === "DISPATCHED") {
          return !!data.trackingNumber && !!data.logisticsPartner;
        }
        return true;
      },
      { message: "trackingNumber and logisticsPartner are required when dispatching" }
    ),

  listQuery: z.object({
    status: z
      .enum(["PENDING", "ACKNOWLEDGED", "PACKED", "DISPATCHED", "DELIVERED", "FAILED"])
      .optional(),
    patientId: z.string().uuid().optional(),
    pharmacyId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};
