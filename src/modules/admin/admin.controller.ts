import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import crypto from "node:crypto";

// Controller class for Admin-specific authentication handlers
export class AdminController {
  // Invite a new Doctor or Pharmacist
  async inviteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, role } = req.body;

      if (!["DOCTOR", "PHARMACIST"].includes(role)) {
        throw new AppError("Invalid role for invitation", 400);
      }

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new AppError("User already exists", 400);
      }

      const invitationToken = crypto.randomBytes(32).toString("hex");

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            password: crypto.randomBytes(16).toString("hex"),
            role: role,
            isActive: false,
          },
        });

        if (role === "DOCTOR") {
          await tx.doctor.create({
            data: {
              userId: user.id,
              fullName: "TBD",
              mdcnRegistration: `PENDING-${user.id}`,
              availability: "{}",
            },
          });
        } else if (role === "PHARMACIST") {
          const pharmacy = await tx.pharmacy.create({
            data: {
              name: "TBD",
              pcnLicence: `PENDING-${user.id}`,
              cities: "[]",
            },
          });
          await tx.pharmacist.create({
            data: {
              userId: user.id,
              pharmacyId: pharmacy.id,
            },
          });
        }

        console.log(`[INVITATION] Token for ${email}: ${invitationToken}`);
      });

      res.status(200).json({
        status: "success",
        message: `Invitation created for ${role}. Token logged to console.`,
      });
    } catch (error) {
      next(error);
    }
  }
}
