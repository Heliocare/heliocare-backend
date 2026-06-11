import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { logger } from "../../lib/logger.js";
import type { UserRole } from "../../generated/prisma/index.js";

interface CreatePlanInput {
  patientId: string;
  title: string;
  description?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

interface UpdatePlanInput {
  title?: string | undefined;
  description?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

export class TreatmentPlanService {
  // Walk backwards to find the root (v1) of a plan lineage.
  private async findRoot(planId: string) {
    const plan = await prisma.treatmentPlan.findUnique({
      where: { id: planId },
      select: { id: true, parentId: true },
    });
    if (!plan) throw new AppError("Treatment plan not found.", 404);

    let current: { id: string; parentId: string | null } = plan;

    // Walk up the parent chain to find the root
    while (current.parentId) {
      const parent: { id: string; parentId: string | null } | null =
        await prisma.treatmentPlan.findUnique({
          where: { id: current.parentId },
          select: { id: true, parentId: true },
        });
      if (!parent) break;
      current = parent;
    }
    return current.id;
  }

  // Walk forwards from root to find the latest version.
  private async findLatest(planId: string) {
    const rootId = await this.findRoot(planId);

    let currentId: string = rootId;

    while (true) {
      const child: { id: string } | null = await prisma.treatmentPlan.findFirst({
        where: { parentId: currentId },
        select: { id: true },
        orderBy: { version: "desc" },
      });
      if (!child) break;
      currentId = child.id;
    }

    return prisma.treatmentPlan.findUnique({
      where: { id: currentId },
      include: {
        professional: { select: { fullName: true, registrationNum: true, specialisation: true } },
      },
    });
  }

  // Fetch all versions in a plan's lineage, newest first.
  private async getVersionChain(planId: string) {
    const rootId = await this.findRoot(planId);

    // Collect all versions by walking forward from root
    const versions: Array<{ id: string; version: number; parentId: string | null }> = [];
    let currentId: string | null = rootId;

    while (currentId) {
      const plan = await prisma.treatmentPlan.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          version: true,
          parentId: true,
          title: true,
          description: true,
          status: true,
          startDate: true,
          endDate: true,
          dietitianReferralStatus: true,
          dietitianReferralNote: true,
          professional: {
            select: { fullName: true, registrationNum: true, specialisation: true },
          },
        },
      });
      if (!plan) break;

      versions.push(plan);

      const child: { id: string } | null = await prisma.treatmentPlan.findFirst({
        where: { parentId: currentId },
        select: { id: true },
        orderBy: { version: "desc" },
      });
      currentId = child?.id ?? null;
    }

    return versions;
  }

  private async checkPlanAccess(
    planId: string,
    requestingUserId: string
  ): Promise<{ role: string; patientId: string }> {
    const plan = await prisma.treatmentPlan.findUnique({
      where: { id: planId },
      select: { patientId: true },
    });

    if (!plan) throw new AppError("Treatment plan not found.", 404);

    const user = await prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { role: true },
    });

    if (!user) throw new AppError("Requesting user not found.", 404);

    const role = user.role as UserRole;

    // PATIENT: only their own plan
    if (role === "PATIENT") {
      const patient = await prisma.patient.findUnique({
        where: { userId: requestingUserId },
        select: { id: true },
      });
      if (!patient || patient.id !== plan.patientId) {
        throw new AppError("You do not have permission to view this treatment plan.", 403);
      }
      return { role, patientId: plan.patientId };
    }

    // DOCTOR / DIETITIAN: must be assigned to patient
    if (role === "DOCTOR" || role === "DIETITIAN") {
      const profile = await prisma.professionalProfile.findUnique({
        where: { userId: requestingUserId },
        select: { id: true },
      });
      if (!profile) throw new AppError("Professional profile not found.", 404);

      const assignment = await prisma.patientProfessional.findUnique({
        where: {
          patientId_professionalId: {
            patientId: plan.patientId,
            professionalId: profile.id,
          },
        },
      });
      if (!assignment) {
        throw new AppError("You are not assigned to this patient.", 403);
      }
      return { role, patientId: plan.patientId };
    }

    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      return { role, patientId: plan.patientId };
    }

    throw new AppError("You do not have permission to access this treatment plan.", 403);
  }

  async create(professionalId: string, userId: string, data: CreatePlanInput) {
    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      select: { id: true },
    });
    if (!patient) throw new AppError("Patient not found.", 404);

    // Verify professional is assigned to patient
    const assignment = await prisma.patientProfessional.findUnique({
      where: {
        patientId_professionalId: {
          patientId: data.patientId,
          professionalId,
        },
      },
    });
    if (!assignment) {
      throw new AppError("You are not assigned to this patient.", 403);
    }

    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.treatmentPlan.create({
        data: {
          patientId: data.patientId,
          professionalId,
          title: data.title,
          description: data.description ?? null,
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          endDate: data.endDate ? new Date(data.endDate) : null,
          version: 1,
          parentId: null,
          dietitianReferralStatus: "NOT_REFERRED",
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "TREATMENT_PLAN_CREATED",
          entityType: "TreatmentPlan",
          entityId: created.id,
          metadata: JSON.stringify({ version: 1, title: data.title }),
        },
      });

      return created;
    });

    return plan;
  }


  async update(planId: string, data: UpdatePlanInput, requestingUserId: string) {
    await this.checkPlanAccess(planId, requestingUserId);

    const current = await this.findLatest(planId);
    if (!current) throw new AppError("Treatment plan not found.", 404);

    // Verify requester is the original creator or admin
    const user = await prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { role: true },
    });
    const role = user!.role as UserRole;

    // Find requesting user's professional profile
    const profile = await prisma.professionalProfile.findUnique({
      where: { userId: requestingUserId },
      select: { id: true },
    });

    if (
      role !== "ADMIN" &&
      role !== "SUPER_ADMIN" &&
      (!profile || profile.id !== current.professionalId)
    ) {
      throw new AppError(
        "Only the original creator or an administrator can update this plan.",
        403
      );
    }

    const hasUpdates = Object.values(data).some((v) => v !== undefined);
    if (!hasUpdates) throw new AppError("No fields to update.", 400);

    const newVersion = current.version + 1;
    const changedFields = Object.keys(data).filter(
      (k) => data[k as keyof UpdatePlanInput] !== undefined
    );

    const created = await prisma.$transaction(async (tx) => {
      // Archive the current version
      await tx.treatmentPlan.update({
        where: { id: current.id },
        data: { status: "COMPLETED" },
      });

      // Create new version
      const next = await tx.treatmentPlan.create({
        data: {
          patientId: current.patientId,
          professionalId: current.professionalId,
          title: data.title ?? current.title,
          description: data.description !== undefined ? data.description : current.description,
          startDate: data.startDate ? new Date(data.startDate) : current.startDate,
          endDate: data.endDate !== undefined
            ? data.endDate
              ? new Date(data.endDate)
              : null
            : current.endDate,
          version: newVersion,
          parentId: current.id,
          // Carry forward referral status
          dietitianReferralStatus: current.dietitianReferralStatus,
          dietitianReferralNote: current.dietitianReferralNote,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: requestingUserId,
          action: "TREATMENT_PLAN_UPDATED",
          entityType: "TreatmentPlan",
          entityId: next.id,
          metadata: JSON.stringify({
            previousVersion: current.version,
            newVersion,
            parentId: current.id,
            changedFields,
          }),
        },
      });

      return next;
    });

    return created;
  }

  async getLatest(planId: string, requestingUserId: string) {
    await this.checkPlanAccess(planId, requestingUserId);

    const latest = await this.findLatest(planId);
    if (!latest) throw new AppError("Treatment plan not found.", 404);

    // Count total versions in the lineage
    const rootId = await this.findRoot(planId);
    let versionCount = 0;
    let currentId: string | null = rootId;
    while (currentId) {
      versionCount++;
      const child: { id: string } | null = await prisma.treatmentPlan.findFirst({
        where: { parentId: currentId },
        select: { id: true },
      });
      currentId = child?.id ?? null;
    }

    return {
      ...latest,
      isLatest: true,
      totalVersions: versionCount,
    };
  }

  async getHistory(planId: string, requestingUserId: string) {
    await this.checkPlanAccess(planId, requestingUserId);

    const versions = await this.getVersionChain(planId);

    // Mark the last one as latest
    const result = versions.map((v, i) => ({
      ...v,
      isLatest: i === 0, // versions are collected newest first since we walk forward from root
    }));

    return result;
  }

  async listByPatient(patientId: string, requestingUserId: string) {
    // Verify access to the patient
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { userId: true },
    });
    if (!patient) throw new AppError("Patient not found.", 404);

    // Reuse patient access check pattern
    const user = await prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { role: true },
    });
    const role = user!.role as UserRole;

    if (role === "DOCTOR" || role === "DIETITIAN") {
      const profile = await prisma.professionalProfile.findUnique({
        where: { userId: requestingUserId },
        select: { id: true },
      });
      if (!profile) throw new AppError("Professional profile not found.", 404);

      const assignment = await prisma.patientProfessional.findUnique({
        where: {
          patientId_professionalId: { patientId, professionalId: profile.id },
        },
      });
      if (!assignment)
        throw new AppError("You are not assigned to this patient.", 403);
    } else if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      throw new AppError("You do not have permission to view these plans.", 403);
    }

    // Get all root plans (v1) for this patient, then walk to latest for each
    const roots = await prisma.treatmentPlan.findMany({
      where: { patientId, parentId: null },
      orderBy: { startDate: "desc" },
      include: {
        professional: {
          select: { fullName: true, registrationNum: true, specialisation: true },
        },
      },
    });

    // For each root, find the latest version (walk forward by ID)
    const plans = await Promise.all(
      roots.map(async (root) => {
        let currentId: string = root.id;
        while (true) {
          const child: { id: string } | null = await prisma.treatmentPlan.findFirst({
            where: { parentId: currentId },
            select: { id: true },
            orderBy: { version: "desc" },
          });
          if (!child) break;
          currentId = child.id;
        }
        // Fetch the full latest record
        const latest = currentId !== root.id
          ? await prisma.treatmentPlan.findUnique({
            where: { id: currentId },
            include: {
              professional: {
                select: { fullName: true, registrationNum: true, specialisation: true },
              },
            },
          })
          : root;

        if (!latest) return { ...root, isLatest: false, totalVersions: root.version };

        return {
          ...latest,
          isLatest: latest.id !== root.id,
          totalVersions: latest.version,
        };
      })
    );

    return plans;
  }

  async referDietitian(
    planId: string,
    data: { dietitianReferralStatus: string; dietitianReferralNote?: string | undefined },
    requestingUserId: string
  ) {
    await this.checkPlanAccess(planId, requestingUserId);

    // Get latest version
    const current = await this.findLatest(planId);
    if (!current) throw new AppError("Treatment plan not found.", 404);

    const previousStatus = current.dietitianReferralStatus;

    await prisma.$transaction(async (tx) => {
      await tx.treatmentPlan.update({
        where: { id: current.id },
        data: {
          dietitianReferralStatus: data.dietitianReferralStatus,
          dietitianReferralNote: data.dietitianReferralNote ?? current.dietitianReferralNote,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: requestingUserId,
          action: "TREATMENT_PLAN_DIETITIAN_REFERRAL",
          entityType: "TreatmentPlan",
          entityId: current.id,
          metadata: JSON.stringify({
            previousStatus,
            newStatus: data.dietitianReferralStatus,
          }),
        },
      });
    });

    logger.info(
      `[TREATMENT_PLAN] Dietitian referral for plan ${current.id}: ${previousStatus} → ${data.dietitianReferralStatus}`
    );

    return { planId: current.id, dietitianReferralStatus: data.dietitianReferralStatus };
  }

  async annotateLabResult(
    resultId: string,
    annotation: string,
    requestingUserId: string
  ) {
    // Verify requesting user is a DOCTOR (or ADMIN/SUPER_ADMIN)
    const user = await prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { role: true },
    });
    if (!user) throw new AppError("User not found.", 404);

    const role = user.role as UserRole;
    if (role !== "DOCTOR" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      throw new AppError("Only doctors can annotate lab results.", 403);
    }

    // Get professional profile
    const profile = await prisma.professionalProfile.findUnique({
      where: { userId: requestingUserId },
      select: { id: true },
    });
    if (!profile && role === "DOCTOR") {
      throw new AppError("Professional profile not found.", 404);
    }

    // Fetch the lab result with its parent request to get patient context
    const result = await prisma.labResult.findUnique({
      where: { id: resultId },
      include: {
        request: { select: { patientId: true } },
      },
    });
    if (!result) throw new AppError("Lab result not found.", 404);

    // Annotate
    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.labResult.update({
        where: { id: resultId },
        data: {
          doctorAnnotation: annotation,
          annotatedById: profile?.id ?? null,
          annotatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: requestingUserId,
          action: "LAB_RESULT_ANNOTATED",
          entityType: "LabResult",
          entityId: resultId,
          metadata: JSON.stringify({
            patientId: result.request.patientId,
            testName: result.testName,
          }),
        },
      });

      return r;
    });

    return updated;
  }
}
