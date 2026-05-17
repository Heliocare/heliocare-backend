import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { Email } from "../../utils/email.js";
import crypto from "node:crypto";
import { RegBody, UserRole, ProfessionalStatus } from "../../generated/prisma/index.js";

// Map User roles to their respective Regulatory Bodies
const ROLE_TO_REGBODY: Record<string, RegBody> = {
  [UserRole.DOCTOR]: RegBody.MDCN,
  [UserRole.PHARMACIST]: RegBody.PCN,
  [UserRole.LAB_SCIENTIST]: RegBody.MLSCN,
  [UserRole.DIETITIAN]: RegBody.ODBN,
};

export class AdminController {
  // Invites a new clinical professional (Doctor, Pharmacist, Lab Scientist, Dietitian)
  async inviteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, role } = req.body;

      // 1. Validate role eligibility for invitation
      const allowedRoles = [UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.LAB_SCIENTIST, UserRole.DIETITIAN];
      if (!allowedRoles.includes(role)) {
        throw new AppError("Invalid role for clinical invitation", 400);
      }

      // 2. Prevent duplicate accounts
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new AppError("A user with this email already exists", 400);
      }

      const invitationToken = crypto.randomBytes(32).toString("hex");

      // 3. Create User and Placeholder Professional Profile in a transaction
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            password: crypto.randomBytes(16).toString("hex"), // Temporary random password
            role: role as UserRole,
            isActive: false, // Inactive until activation AND approval
            emailVerificationToken: invitationToken,
            emailVerificationExpires: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48hr expiry
          },
        });

        await tx.professionalProfile.create({
          data: {
            userId: user.id,
            fullName: "TBD", // To be filled by user during activation
            registrationNum: `PENDING-${user.id}`, // Unique placeholder
            regBody: ROLE_TO_REGBODY[role] as RegBody,
            status: ProfessionalStatus.PENDING,
          },
        });
      });

      // 4. Dispatch Invitation Email
      await Email.sendInvitationEmail(email, invitationToken);

      res.status(200).json({
        status: "success",
        message: `Invitation successfully sent to ${email} as ${role}. Link expires in 48 hours.`,
      });
    } catch (error) {
      next(error);
    }
  }

  // List professionals awaiting approval
  async getPendingProfessionals(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pending = await prisma.professionalProfile.findMany({
        where: { status: ProfessionalStatus.PENDING },
        include: { user: { select: { email: true, role: true, createdAt: true } } },
      });

      res.status(200).json({ status: "success", data: pending });
    } catch (error) {
      next(error);
    }
  }

  // Approve a professional after credential review
  async approveProfessional(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const profile = await prisma.professionalProfile.findUnique({ where: { id } });

      if (!profile) throw new AppError("Professional profile not found", 404);

      await prisma.$transaction([
        prisma.professionalProfile.update({
          where: { id: id as string },
          data: { status: ProfessionalStatus.VERIFIED },
        }),
        prisma.user.update({
          where: { id: profile.userId },
          data: { isActive: true },
        }),
      ]);

      res.status(200).json({ status: "success", message: "Professional approved and activated" });
    } catch (error) {
      next(error);
    }
  }
}
