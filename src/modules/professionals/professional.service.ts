import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { logger } from "../../lib/logger.js";
import { notifyPatientReassigned } from "../../lib/notifications/index.js";
import type {
  DeactivationReason,
  ProfessionalStatus,
  UserRole,
} from "../../generated/prisma/index.js";

interface CompleteProfileInput {
  fullName: string;
  registrationNum: string;
  specialisation?: string | undefined;
  availability?: string | undefined;
}

interface UpdateAvailabilityInput {
  availability: { day: string; startTime: string; endTime: string }[];
  maxOpenConsults?: number | undefined;
}

interface ListFilters {
  status?: string | undefined;
  regBody?: string | undefined;
  role?: string | undefined;
  page: number;
  limit: number;
}

const ROLES_REQUIRING_AVAILABILITY: UserRole[] = ["DOCTOR", "DIETITIAN"];

export class ProfessionalService {
  async completeProfile(userId: string, data: CompleteProfileInput) {
    const profile = await prisma.professionalProfile.findUnique({
      where: { userId },
      include: { user: { select: { role: true } } },
    });

    if (!profile) {
      throw new AppError("Professional profile not found.", 404);
    }

    const role = profile.user.role as UserRole;

    if (ROLES_REQUIRING_AVAILABILITY.includes(role)) {
      if (!data.availability) {
        throw new AppError("Availability schedule is required for your role.", 400);
      }
      try {
        const parsed = JSON.parse(data.availability);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new AppError("Availability must be a non-empty array of time slots.", 400);
        }
      } catch {
        throw new AppError("Availability must be valid JSON.", 400);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.professionalProfile.update({
        where: { id: profile.id },
        data: {
          fullName: data.fullName,
          registrationNum: data.registrationNum,
          specialisation: data.specialisation ?? null,
          availability: data.availability ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "PROFESSIONAL_PROFILE_COMPLETED",
          entityType: "ProfessionalProfile",
          entityId: profile.id,
        },
      });

      return result;
    });

    return updated;
  }

  async updateAvailability(
    userId: string,
    data: UpdateAvailabilityInput
  ) {
    const profile = await prisma.professionalProfile.findUnique({
      where: { userId },
      include: { user: { select: { role: true } } },
    });

    if (!profile) {
      throw new AppError("Professional profile not found.", 404);
    }

    const updateData: Record<string, unknown> = {
      availability: JSON.stringify(data.availability),
    };

    if (data.maxOpenConsults !== undefined) {
      updateData.maxOpenConsults = data.maxOpenConsults;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.professionalProfile.update({
        where: { id: profile.id },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "PROFESSIONAL_AVAILABILITY_UPDATED",
          entityType: "ProfessionalProfile",
          entityId: profile.id,
          metadata: JSON.stringify({
            slotCount: data.availability.length,
            maxOpenConsults: data.maxOpenConsults,
          }),
        },
      });

      return result;
    });

    return updated;
  }

  async suspendProfessional(professionalId: string, adminUserId: string, reason: string) {
    const profile = await prisma.professionalProfile.findUnique({
      where: { id: professionalId },
    });

    if (!profile) {
      throw new AppError("Professional profile not found.", 404);
    }

    if (profile.status !== "VERIFIED") {
      throw new AppError("Only verified professionals can be suspended.", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.professionalProfile.update({
        where: { id: professionalId },
        data: {
          status: "SUSPENDED" as ProfessionalStatus,
          isAvailable: false,
        },
      });

      await tx.user.update({
        where: { id: profile.userId },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: "PROFESSIONAL_SUSPENDED",
          entityType: "ProfessionalProfile",
          entityId: professionalId,
          metadata: JSON.stringify({ reason }),
        },
      });
    });

    logger.info(`[PROFESSIONAL] ${professionalId} suspended by admin ${adminUserId}: ${reason}`);

    return { message: "Professional suspended successfully." };
  }

  async deactivateProfessional(
    professionalId: string,
    adminUserId: string,
    reason: DeactivationReason
  ) {
    const profile = await prisma.professionalProfile.findUnique({
      where: { id: professionalId },
    });

    if (!profile) {
      throw new AppError("Professional profile not found.", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: profile.userId },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: "PROFESSIONAL_DEACTIVATED",
          entityType: "ProfessionalProfile",
          entityId: professionalId,
          metadata: JSON.stringify({ reason }),
        },
      });
    });

    logger.info(`[PROFESSIONAL] ${professionalId} deactivated by admin ${adminUserId}: ${reason}`);

    return { message: "Professional deactivated permanently." };
  }

  async reassignPatients(
    fromProfessionalId: string,
    toProfessionalId: string,
    adminUserId: string,
    reason: string
  ) {
    const [fromProfile, toProfile] = await Promise.all([
      prisma.professionalProfile.findUnique({ where: { id: fromProfessionalId } }),
      prisma.professionalProfile.findUnique({
        where: { id: toProfessionalId },
        include: { user: { select: { isActive: true } } },
      }),
    ]);

    if (!fromProfile) {
      throw new AppError("Source professional not found.", 404);
    }

    if (!toProfile) {
      throw new AppError("Target professional not found.", 404);
    }

    if (toProfile.status !== "VERIFIED" || !toProfile.user.isActive) {
      throw new AppError("Target professional must be verified and active.", 400);
    }

    if (!toProfile.isAvailable) {
      throw new AppError("Target professional is not accepting new patients.", 400);
    }

    const existingAssignments = await prisma.patientProfessional.findMany({
      where: { professionalId: fromProfessionalId },
      include: {
        patient: {
          include: { user: { select: { phone: true } } },
        },
      },
    });

    if (existingAssignments.length === 0) {
      return { message: "No patients to reassign.", reassignedCount: 0 };
    }

    const toPatientCount = await prisma.patientProfessional.count({
      where: { professionalId: toProfessionalId },
    });

    if (
      toProfile.maxOpenConsults > 0 &&
      toPatientCount + existingAssignments.length > toProfile.maxOpenConsults
    ) {
      throw new AppError(
        `Target professional would exceed their max concurrent patients (${toProfile.maxOpenConsults}).`,
        400
      );
    }

    const patients = existingAssignments.map((a) => ({
      patientId: a.patientId,
      phone: a.patient.user?.phone,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.patientProfessional.deleteMany({
        where: { professionalId: fromProfessionalId },
      });

      await tx.patientProfessional.createMany({
        data: patients.map((p) => ({
          patientId: p.patientId,
          professionalId: toProfessionalId,
        })),
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: "PATIENTS_REASSIGNED",
          entityType: "ProfessionalProfile",
          entityId: fromProfessionalId,
          metadata: JSON.stringify({
            fromId: fromProfessionalId,
            toId: toProfessionalId,
            patientCount: patients.length,
            reason,
          }),
        },
      });
    });

    for (const patient of patients) {
      if (patient.phone) {
        notifyPatientReassigned(patient.phone, toProfile.fullName).catch((err) =>
          logger.error({ err }, "Failed to send reassignment WhatsApp notification")
        );
      }
    }

    logger.info(
      `[PROFESSIONAL] ${patients.length} patients reassigned from ${fromProfessionalId} to ${toProfessionalId}`
    );

    return {
      message: "Patients reassigned successfully.",
      reassignedCount: patients.length,
    };
  }

  async getProfessionalById(professionalId: string) {
    const profile = await prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      include: {
        user: { select: { email: true, role: true, isActive: true, createdAt: true } },
        _count: { select: { patients: true } },
      },
    });

    if (!profile) {
      throw new AppError("Professional profile not found.", 404);
    }

    return profile;
  }

  async listProfessionals(filters: ListFilters) {
    const { status, regBody, role, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (regBody) where.regBody = regBody;
    if (role) {
      where.user = { role };
    }

    const [professionals, total] = await Promise.all([
      prisma.professionalProfile.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { email: true, role: true, isActive: true } },
          _count: { select: { patients: true } },
        },
        orderBy: { id: "asc" },
      }),
      prisma.professionalProfile.count({ where }),
    ]);

    return { professionals, total, page, limit };
  }
}
