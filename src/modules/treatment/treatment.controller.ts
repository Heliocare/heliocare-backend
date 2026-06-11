import type { Request, Response, NextFunction } from "express";
import { TreatmentPlanService } from "./treatment.service.js";
import { treatmentPlanSchema } from "./treatment.schema.js";
import { prisma } from "../../lib/prisma.js";

const service = new TreatmentPlanService();

export class TreatmentPlanController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = treatmentPlanSchema.create.parse(req.body);

      // Resolve the doctor's professional profile
      const profile = await prisma.professionalProfile.findUnique({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      if (!profile) {
        res.status(404).json({ status: "error", message: "Professional profile not found." });
        return;
      }

      const plan = await service.create(profile.id, req.user!.id, parsed);
      res.status(201).json({
        status: "success",
        message: "Treatment plan created successfully",
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = treatmentPlanSchema.update.parse(req.body);
      const plan = await service.update(
        req.params.id as string,
        parsed,
        req.user!.id
      );
      res.status(200).json({
        status: "success",
        message: "Treatment plan updated — new version created",
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLatest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await service.getLatest(req.params.id as string, req.user!.id);
      res.status(200).json({ status: "success", data: plan });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versions = await service.getHistory(req.params.id as string, req.user!.id);
      res.status(200).json({ status: "success", data: versions });
    } catch (error) {
      next(error);
    }
  }

  async listByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await service.listByPatient(
        req.params.patientId as string,
        req.user!.id
      );
      res.status(200).json({ status: "success", data: plans });
    } catch (error) {
      next(error);
    }
  }

  async referDietitian(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = treatmentPlanSchema.referDietitian.parse(req.body);
      const result = await service.referDietitian(
        req.params.id as string,
        parsed,
        req.user!.id
      );
      res.status(200).json({
        status: "success",
        message: "Dietitian referral status updated",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async annotateLabResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = treatmentPlanSchema.annotateLabResult.parse(req.body);
      const result = await service.annotateLabResult(
        req.params.resultId as string,
        parsed.annotation,
        req.user!.id
      );
      res.status(200).json({
        status: "success",
        message: "Lab result annotated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
