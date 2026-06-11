import type { Request, Response, NextFunction } from "express";
import { ProfessionalService } from "./professional.service.js";
import { professionalSchema } from "./professional.schema.js";

const professionalService = new ProfessionalService();

export class ProfessionalController {
  async completeProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = professionalSchema.completeProfile.parse(req.body);
      const result = await professionalService.completeProfile(
        req.user!.id,
        parsedBody
      );
      res.status(200).json({
        status: "success",
        message: "Profile completed successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = professionalSchema.updateAvailability.parse(req.body);
      const result = await professionalService.updateAvailability(
        req.user!.id,
        parsedBody
      );
      res.status(200).json({
        status: "success",
        message: "Availability updated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async suspend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = professionalSchema.suspend.parse(req.body);
      const result = await professionalService.suspendProfessional(
        req.params.id as string,
        req.user!.id,
        parsedBody.reason
      );
      res.status(200).json({
        status: "success",
        message: "Professional suspended successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = professionalSchema.deactivate.parse(req.body);
      const result = await professionalService.deactivateProfessional(
        req.params.id as string,
        req.user!.id,
        parsedBody.reason
      );
      res.status(200).json({
        status: "success",
        message: "Professional deactivated permanently",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async reassignPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = professionalSchema.reassignPatients.parse(req.body);
      const result = await professionalService.reassignPatients(
        parsedBody.fromProfessionalId,
        parsedBody.toProfessionalId,
        req.user!.id,
        parsedBody.reason
      );
      res.status(200).json({
        status: "success",
        message: "Patients reassigned successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await professionalService.getProfessionalById(req.params.id as string);
      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedQuery = professionalSchema.listQuery.parse(req.query);
      const result = await professionalService.listProfessionals(parsedQuery);
      res.status(200).json({
        status: "success",
        data: result.professionals,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
