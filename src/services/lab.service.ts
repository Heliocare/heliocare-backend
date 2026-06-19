import { prisma } from "../lib/prisma.js";
import { Crypto } from "../utils/crypto.js";

export class ServiceError extends Error {
    constructor(message: string, public code: string, public statusCode: number) {
        super(message);
        this.name = "ServiceError";
    }
}

export const LabService = {
    async createOrder(userId: string, patientId: string, panelType: string) {
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient || patient.userId !== userId) throw new ServiceError("Forbidden", "FORBIDDEN", 403);

        const order = await prisma.labOrder.create({
            data: {
                patientId,
                panelType,
                status: "PENDING"
            }
        });

        return { orderId: order.id, status: order.status };
    },

    async processWebhook(payload: any) {
        // In real environments, webhooks use header signing validation (e.g. HMAC).
        const { orderId, status, biomarkers, pdfUrl } = payload;

        const order = await prisma.labOrder.findUnique({ where: { id: orderId } });
        if (!order) throw new ServiceError("Order not found", "NOT_FOUND", 404);

        if (status === "RESULTED") {
            const encryptedBiomarkers = Crypto.encrypt(JSON.stringify(biomarkers || {}));

            await prisma.labOrder.update({
                where: { id: order.id },
                data: { status }
            });

            await prisma.labOrderResult.create({
                data: {
                    labOrderId: order.id,
                    biomarkersEnc: encryptedBiomarkers,
                    pdfUrl
                }
            });
        } else {
            await prisma.labOrder.update({
                where: { id: order.id },
                data: { status }
            });
        }

        return { processed: true, orderId };
    },

    async getPatientLabs(userId: string, patientId: string) {
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient || patient.userId !== userId) throw new ServiceError("Forbidden", "FORBIDDEN", 403);

        const orders = await prisma.labOrder.findMany({
            where: { patientId },
            include: { results: true }
        });

        const decryptedOrders = orders.map((order: any) => ({
            ...order,
            results: order.results.map((r: any) => ({
                ...r,
                biomarkers: JSON.parse(Crypto.decrypt(r.biomarkersEnc))
            }))
        }));

        return decryptedOrders;
    }
};
