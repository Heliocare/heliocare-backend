import type { Request, Response, NextFunction } from "express";
import { PatientService } from "./patient.service.js";
import { patientSchema } from "./patient.schema.js";

const patientService = new PatientService();

export class PatientController {
  // GET /me or GET /:id
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId =
        (req.params.id as string | undefined) ?? (await patientService.resolvePatientId(req.user!.id));

      const result = await patientService.getProfile(patientId, req.user!.id);

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /me
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = patientSchema.updateProfile.parse(req.body);
      const patientId = await patientService.resolvePatientId(req.user!.id);

      const result = await patientService.updateProfile(patientId, parsedBody, req.user!.id);

      res.status(200).json({
        status: "success",
        message: "Profile updated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /me/export
  async exportData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = await patientService.resolvePatientId(req.user!.id);

      const result = await patientService.exportData(patientId);

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /me
  async requestDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = await patientService.resolvePatientId(req.user!.id);

      const result = await patientService.requestDeletion(patientId);

      res.status(200).json({
        status: "success",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /me/correct
  async correctData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = patientSchema.correctData.parse(req.body);
      const patientId = await patientService.resolvePatientId(req.user!.id);

      const result = await patientService.correctData(
        patientId,
        parsedBody.corrections,
        parsedBody.reason,
        req.user!.id
      );

      res.status(200).json({
        status: "success",
        message: "Data correction submitted successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
