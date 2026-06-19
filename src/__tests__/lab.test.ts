import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { prisma } from "../lib/prisma.js";
import labRoutes from "../routes/lab.routes.js";

// Mock Auth
vi.mock("../middleware/auth.js", () => {
    return {
        verifyAccessToken: (req: any, _res: any, next: any) => {
            req.user = { id: "doctor-123", role: req.headers["x-role"] || "Doctor" };
            next();
        },
        requireRole: (_roles: string[]) => (_req: any, _res: any, next: any) => next()
    };
});

// Mock Prisma
vi.mock("../lib/prisma.js", () => {
    return {
        prisma: {
            patient: { findUnique: vi.fn() },
            labOrder: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
            labOrderResult: { create: vi.fn() }
        }
    };
});

// Mock Crypto
vi.mock("../utils/crypto.js", () => ({
    Crypto: {
        encrypt: vi.fn().mockImplementation((val) => val),
        decrypt: vi.fn().mockImplementation((val) => val)
    }
}));

// Setup Test App
const app = express();
app.use(express.json());
app.use("/api/v1/labs", labRoutes);
app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status || err.statusCode || 500).json({ success: false, error: { message: err.message, code: err.code } });
});

describe("Lab Endpoints", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("POST /api/v1/labs/order - creates a new lab order", async () => {
        vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: "patient-1", userId: "doctor-123" } as any);
        vi.mocked(prisma.labOrder.create).mockResolvedValue({ id: "order-1", status: "PENDING" } as any);

        const res = await request(app).post("/api/v1/labs/order").send({ patientId: "00000000-0000-0000-0000-000000000000", panelType: "Comprehensive" });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.orderId).toBe("order-1");
    });

    it("POST /api/v1/labs/webhook - processes webhook and creates lab result", async () => {
        vi.mocked(prisma.labOrder.findUnique).mockResolvedValue({ id: "order-1", status: "PENDING" } as any);
        vi.mocked(prisma.labOrder.update).mockResolvedValue({} as any);
        vi.mocked(prisma.labOrderResult.create).mockResolvedValue({} as any);

        const res = await request(app)
            .post("/api/v1/labs/webhook")
            .send({
                orderId: "00000000-0000-0000-0000-000000000000",
                status: "RESULTED",
                biomarkers: { hba1c: "5.4%" },
                pdfUrl: "https://example.com/result.pdf"
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(prisma.labOrderResult.create).toHaveBeenCalled();
    });

    it("GET /api/v1/labs/patient/:patientId - gets patient lab orders and deciphers crypto", async () => {
        vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: "patient-1", userId: "doctor-123" } as any);
        vi.mocked(prisma.labOrder.findMany).mockResolvedValue([
            {
                id: "order-1",
                patientId: "patient-1",
                results: [
                    { id: "result-1", biomarkersEnc: JSON.stringify({ testosterone: "400 ng/dL" }) }
                ]
            }
        ] as any);

        const res = await request(app).get("/api/v1/labs/patient/patient-1");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data[0].results[0].biomarkers.testosterone).toBe("400 ng/dL");
    });
});
