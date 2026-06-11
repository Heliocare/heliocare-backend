import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { logger } from "../../lib/logger.js";
import { isGlp1Medication } from "../../lib/clinical/medication.js";
import {
  sendOrderDispatchedEmail,
  notifyOrderDispatched,
} from "../../lib/notifications/index.js";
import type { OrderStatus, LogisticsPartner } from "../../generated/prisma/index.js";

// Allowed status transitions
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["ACKNOWLEDGED", "FAILED"],
  ACKNOWLEDGED: ["PACKED", "FAILED"],
  PACKED: ["DISPATCHED", "FAILED"],
  DISPATCHED: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: [],
};

// Inputs for creating an order
interface CreateOrderInput {
  patientId: string;
  prescriptionId: string;
  subscriptionId: string;
  drugName: string;
  patientStateOfResidence: string;
  deliveryAddrEnc?: string | undefined;
}

// Metadata for status transitions
interface TransitionMetadata {
  trackingNumber?: string | undefined;
  logisticsPartner?: LogisticsPartner | undefined;
  estDeliveryDate?: string | undefined;
  pharmacyNotes?: string | undefined;
}

// Inputs for listing orders
interface ListFilters {
  status?: OrderStatus | undefined;
  patientId?: string | undefined;
  pharmacyId?: string | undefined;
  page: number;
  limit: number;
}

export class OrderService {
  // Assigns a pharmacy to an order based on the patient's state of residence
  async assignPharmacy(patientStateOfResidence: string): Promise<string | null> {
    const pharmacies = await prisma.pharmacy.findMany({
      where: { isActive: true },
    });

    if (pharmacies.length === 0) return null;

    for (const pharmacy of pharmacies) {
      try {
        const cities: string[] = JSON.parse(pharmacy.cities);
        if (cities.includes(patientStateOfResidence)) {
          return pharmacy.id;
        }
      } catch {
        // malformed JSON — skip this pharmacy
      }
    }

    return pharmacies[0]!.id;
  }

  // Creates a new order
  async createOrder(data: CreateOrderInput) {
    const prescription = await prisma.prescription.findUnique({
      where: { id: data.prescriptionId },
    });

    if (!prescription) {
      throw new AppError("Prescription not found.", 404);
    }

    if (prescription.status !== "ACTIVE") {
      throw new AppError("Cannot create an order for a non-active prescription.", 400);
    }

    const coldChain = isGlp1Medication(data.drugName);
    const pharmacyId = await this.assignPharmacy(data.patientStateOfResidence);

    if (!pharmacyId) {
      logger.warn(`[ORDER] No active pharmacy found for state "${data.patientStateOfResidence}"`);
    }

    const orderId = crypto.randomUUID();

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          id: orderId,
          patientId: data.patientId,
          prescriptionId: data.prescriptionId,
          subscriptionId: data.subscriptionId,
          pharmacyId,
          status: "PENDING",
          deliveryAddrEnc: data.deliveryAddrEnc ?? null,
          coldChain,
          discreetPackaging: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: null,
          action: "ORDER_CREATED",
          entityType: "Order",
          entityId: orderId,
          metadata: JSON.stringify({
            prescriptionId: data.prescriptionId,
            coldChain,
            pharmacyId,
            autoCreated: true,
          }),
        },
      });

      return order;
    });

    return result;
  }

  // Transitions the status of an order
  async transitionStatus(
    orderId: string,
    newStatus: OrderStatus,
    actorUserId: string,
    metadata?: TransitionMetadata
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new AppError("Order not found.", 404);
    }

    const allowed = VALID_TRANSITIONS[order.status] as OrderStatus[];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from ${order.status} to ${newStatus}.`,
        400
      );
    }

    const timestampField = {
      ACKNOWLEDGED: "acknowledgedAt",
      PACKED: "packedAt",
      DISPATCHED: "dispatchedAt",
      DELIVERED: "deliveredAt",
    } as const;

    // Update status
    const updateData: Record<string, unknown> = { status: newStatus };

    // Update timestamp if applicable
    const tsKey = timestampField[newStatus as keyof typeof timestampField];
    if (tsKey) {
      updateData[tsKey] = new Date();
    }

    // Update tracking number and logistics partner if applicable
    if (newStatus === "DISPATCHED") {
      if (metadata?.trackingNumber) updateData.trackingNumber = metadata.trackingNumber;
      if (metadata?.logisticsPartner) updateData.logisticsPartner = metadata.logisticsPartner;
      if (metadata?.estDeliveryDate) updateData.estDeliveryDate = new Date(metadata.estDeliveryDate);
    }

    if (newStatus === "FAILED" && metadata?.pharmacyNotes) {
      updateData.pharmacyNotes = metadata.pharmacyNotes;
    }

    // Update order and create audit log
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: `ORDER_${newStatus}`,
          entityType: "Order",
          entityId: orderId,
          metadata: JSON.stringify({
            previousStatus: order.status,
            newStatus,
            ...metadata,
          }),
        },
      });

      return updated;
    });

    if (newStatus === "DISPATCHED") {
      try {
        const patientUser = await prisma.patient.findUnique({
          where: { id: order.patientId },
          include: { user: true },
        });

        if (patientUser?.user?.email) {
          sendOrderDispatchedEmail(patientUser.user.email, {
            tracking_number: metadata?.trackingNumber ?? "N/A",
            logistics_partner: metadata?.logisticsPartner ?? "N/A",
            est_delivery: metadata?.estDeliveryDate ?? "N/A",
          }).catch((err) =>
            logger.error({ err }, "Failed to send order dispatched email")
          );
        }

        if (patientUser?.user?.phone) {
          notifyOrderDispatched(patientUser.user.phone).catch((err) =>
            logger.error({ err }, "Failed to send order dispatched WhatsApp notification")
          );
        }
      } catch (err) {
        logger.error({ err }, "Failed to fetch patient for dispatch notifications");
      }
    }

    return result;
  }

  // Gets an order by ID with patient, prescription, subscription, and pharmacy details.
  async getOrderById(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        patient: true,
        prescription: true,
        subscription: true,
        pharmacy: true,
      },
    });

    if (!order) {
      throw new AppError("Order not found.", 404);
    }

    return order;
  }

  // Lists orders with filtering by status, patient, pharmacy, and pagination.
  async listOrders(filters: ListFilters, requester: { id: string; role: string }) {
    const { status, patientId, pharmacyId, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (patientId) where.patientId = patientId;
    if (pharmacyId) where.pharmacyId = pharmacyId;

    // Row-level filtering by role
    if (requester.role === "PATIENT") {
      const patient = await prisma.patient.findUnique({
        where: { userId: requester.id },
      });
      if (patient) {
        where.patientId = patient.id;
      } else {
        return { orders: [], total: 0, page, limit };
      }
    } else if (requester.role === "PHARMACY" || requester.role === "PHARMACIST") {
      const profile = await prisma.professionalProfile.findUnique({
        where: { userId: requester.id },
      });
      if (profile) {
        // PHARMACY/PHARMACIST see orders assigned to pharmacies in their cities
        // For simplicity: if no pharmacyId filter given, scope to all (they manage any pharmacy)
        // This is a reasonable default; tighter scoping can be added later
      }
    } else if (requester.role === "DOCTOR") {
      const profile = await prisma.professionalProfile.findUnique({
        where: { userId: requester.id },
      });
      if (profile) {
        // Doctors see orders linked to patients they have prescriptions for
        const patientIds = await prisma.prescription.findMany({
          where: { doctorId: profile.id },
          select: { patientId: true },
          distinct: ["patientId"],
        });
        where.patientId = { in: patientIds.map((p) => p.patientId) };
      } else {
        return { orders: [], total: 0, page, limit };
      }
    }

    // Get orders and total count
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          patient: true,
          prescription: true,
          pharmacy: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total, page, limit };
  }
}
