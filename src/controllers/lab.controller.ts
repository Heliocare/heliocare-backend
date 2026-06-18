import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { sendSuccess, sendError } from "../utils/response.js";
import { LabService, ServiceError } from "../services/lab.service.js";

export const labValidation = {
    orderSchema: z.object({
        patientId: z.string().uuid(),
        panelType: z.string().min(1)
    }).strict(),
    webhookSchema: z.object({
        orderId: z.string().uuid(),
        status: z.enum(["PENDING", "DRAWN", "RESULTED", "CANCELLED"]),
        biomarkers: z.record(z.string(), z.any()).optional(),
        pdfUrl: z.string().url().optional()
    }).strict()
};

export const LabController = {
    createOrder: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { patientId, panelType } = req.body;
            const result = await LabService.createOrder(req.user!.id, patientId, panelType);
            sendSuccess(res, result, 201);
        } catch (e: any) {
            if (e instanceof ServiceError) sendError(res, e.message, e.code, e.statusCode);
            else next(e);
        }
    },

    processWebhook: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await LabService.processWebhook(req.body);
            sendSuccess(res, result);
        } catch (e: any) {
            if (e instanceof ServiceError) sendError(res, e.message, e.code, e.statusCode);
            else next(e);
        }
    },

    getPatientLabs: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const patientId = req.params["patientId"] as string;
            const result = await LabService.getPatientLabs(req.user!.id, patientId);
            sendSuccess(res, result);
        } catch (e: any) {
            if (e instanceof ServiceError) sendError(res, e.message, e.code, e.statusCode);
            else next(e);
        }
    }
};
