import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { Crypto } from "../../utils/crypto.js";
import { Email } from "../../utils/email.js";
import { logger } from "../../lib/logger.js";
import type { UserRole } from "../../generated/prisma/index.js";

// Allowed fields for NDPR data correction
const CORRECTABLE_FIELDS = [
  "firstName",
  "lastName",
  "gender",
  "dob",
  "address",
  "stateOfResidence",
  "marketingOptIn",
] as const;

interface UpdateProfileInput {
  firstName?: string | undefined;
  lastName?: string | undefined;
  gender?: string | undefined;
  dob?: string | undefined;
  address?: string | undefined;
  stateOfResidence?: string | undefined;
  marketingOptIn?: boolean | undefined;
}

interface PatientRecord {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  gender: string;
  dob: Date;
  address: string;
  stateOfResidence: string;
  firstNameEnc: string | null;
  lastNameEnc: string | null;
  genderEnc: string | null;
  dobEnc: string | null;
  addressEnc: string | null;
  stateOfResidenceEnc: string | null;
  ndprConsentAt: Date | null;
  marketingOptIn: boolean;
  accountStatus: string;
  scheduledForDeletionAt: Date | null;
}

export class PatientService {
  // ── PII Helpers ──────────────────────────────────────────────

  // Decrypts an encrypted PII field, falling back to the plaintext value.
  private decryptField(
    encryptedValue: string | null,
    plaintextFallback: string,
    fieldName: string
  ): string {
    if (encryptedValue) {
      try {
        return Crypto.decrypt(encryptedValue);
      } catch (err) {
        logger.error({ err, fieldName }, "Failed to decrypt PII field — falling back to plaintext");
      }
    }
    return plaintextFallback;
  }

  // Decrypts all PII fields on a Patient record.
  private decryptPatientPii(record: PatientRecord) {
    return {
      firstName: this.decryptField(record.firstNameEnc, record.firstName, "firstName"),
      lastName: this.decryptField(record.lastNameEnc, record.lastName, "lastName"),
      gender: this.decryptField(record.genderEnc, record.gender, "gender"),
      dob: this.decryptField(record.dobEnc, record.dob.toISOString().slice(0, 10), "dob"),
      address: this.decryptField(record.addressEnc, record.address, "address"),
      stateOfResidence: this.decryptField(
        record.stateOfResidenceEnc,
        record.stateOfResidence,
        "stateOfResidence"
      ),
    };
  }

  // Builds an encrypted update payload for the given profile fields.
  private buildEncryptedUpdateData(data: UpdateProfileInput): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};

    if (data.firstName !== undefined) {
      updateData.firstNameEnc = Crypto.encrypt(data.firstName);
    }
    if (data.lastName !== undefined) {
      updateData.lastNameEnc = Crypto.encrypt(data.lastName);
    }
    if (data.gender !== undefined) {
      updateData.genderEnc = Crypto.encrypt(data.gender);
    }
    if (data.dob !== undefined) {
      updateData.dobEnc = Crypto.encrypt(data.dob);
    }
    if (data.address !== undefined) {
      updateData.addressEnc = Crypto.encrypt(data.address);
    }
    if (data.stateOfResidence !== undefined) {
      updateData.stateOfResidenceEnc = Crypto.encrypt(data.stateOfResidence);
    }
    if (data.marketingOptIn !== undefined) {
      updateData.marketingOptIn = data.marketingOptIn;
    }

    return updateData;
  }

  // ── Access Control ───────────────────────────────────────────

  // Resolves a user's patient ID
  async resolvePatientId(userId: string): Promise<string> {
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!patient) {
      throw new AppError("Patient record not found.", 404);
    }
    return patient.id;
  }

  // Checks whether `requestingUserId` can access `patientId`.
  async checkAccess(
    patientId: string,
    requestingUserId: string
  ): Promise<{ role: string; patientUserId: string }> {
    const [patient, requestingUser] = await Promise.all([
      prisma.patient.findUnique({
        where: { id: patientId },
        select: { userId: true },
      }),
      prisma.user.findUnique({
        where: { id: requestingUserId },
        select: { role: true },
      }),
    ]);

    if (!patient) {
      throw new AppError("Patient not found.", 404);
    }

    if (!requestingUser) {
      throw new AppError("Requesting user not found.", 404);
    }

    const role = requestingUser.role as UserRole;

    // Patients can only access their own record
    if (role === "PATIENT") {
      if (patient.userId !== requestingUserId) {
        throw new AppError("You do not have permission to access this patient's data.", 403);
      }
      return { role, patientUserId: patient.userId };
    }

    // Doctors and dietitians must be assigned to the patient
    if (role === "DOCTOR" || role === "DIETITIAN") {
      const professionalProfile = await prisma.professionalProfile.findUnique({
        where: { userId: requestingUserId },
        select: { id: true },
      });

      if (!professionalProfile) {
        throw new AppError("Professional profile not found.", 404);
      }

      const assignment = await prisma.patientProfessional.findUnique({
        where: {
          patientId_professionalId: {
            patientId,
            professionalId: professionalProfile.id,
          },
        },
      });

      if (!assignment) {
        throw new AppError("You are not assigned to this patient.", 403);
      }

      return { role, patientUserId: patient.userId };
    }

    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      return { role, patientUserId: patient.userId };
    }

    throw new AppError("You do not have permission to access this patient's data.", 403);
  }

  // ── Profile ──────────────────────────────────────────────────

  // Fetches a patient's profile with decrypted PII.
  async getProfile(patientId: string, requestingUserId: string) {
    await this.checkAccess(patientId, requestingUserId);

    const record = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: {
          select: {
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        subscriptions: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            planCode: true,
            vertical: true,
            status: true,
          },
          take: 5,
        },
        intakes: {
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            vertical: true,
            submittedAt: true,
          },
        },
      },
    });

    if (!record) {
      throw new AppError("Patient not found.", 404);
    }

    // Decrypt PII
    const profile = this.decryptPatientPii(record as PatientRecord);

    // Write audit log (fire and forget — don't block response)
    prisma.auditLog
      .create({
        data: {
          userId: requestingUserId,
          action: "PATIENT_PROFILE_VIEWED",
          entityType: "Patient",
          entityId: patientId,
        },
      })
      .catch((err) => logger.error({ err }, "Failed to write audit log"));

    return {
      id: record.id,
      userId: record.userId,
      profile,
      account: {
        ndprConsentAt: record.ndprConsentAt,
        marketingOptIn: record.marketingOptIn,
        accountStatus: record.accountStatus,
        scheduledForDeletionAt: record.scheduledForDeletionAt,
      },
      email: record.user.email,
      isActive: record.user.isActive,
      createdAt: record.user.createdAt,
      summary: {
        activeSubscriptions: record.subscriptions.length,
        latestIntakeStatus: record.intakes[0]?.status ?? null,
      },
    };
  }

  // Updates the authenticated patient's own profile.
  async updateProfile(patientId: string, data: UpdateProfileInput, requestingUserId: string) {
    const access = await this.checkAccess(patientId, requestingUserId);
    if (access.role === "DOCTOR" || access.role === "DIETITIAN") {
      throw new AppError("Only the patient can update their own profile.", 403);
    }

    const hasUpdates = Object.values(data).some((v) => v !== undefined);
    if (!hasUpdates) {
      throw new AppError("No fields to update.", 400);
    }

    const encryptedData = this.buildEncryptedUpdateData(data);
    const updatedFields = Object.keys(data).filter((k) => data[k as keyof UpdateProfileInput] !== undefined);

    await prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id: patientId },
        data: encryptedData,
      });

      await tx.auditLog.create({
        data: {
          userId: requestingUserId,
          action: "PATIENT_PROFILE_UPDATED",
          entityType: "Patient",
          entityId: patientId,
          metadata: JSON.stringify({ updatedFields }),
        },
      });
    });

    return this.getProfile(patientId, requestingUserId);
  }

  // ── NDPR: Data Export ────────────────────────────────────────

  // Comprehensive NDPR data export (right of access / data portability).
  async exportData(patientId: string) {
    const record = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            isEmailVerified: true,
            mfaEnabled: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        subscriptions: {
          include: {
            paymentEvents: {
              select: {
                id: true,
                event: true,
                paystackRef: true,
                amount: true,
                processedAt: true,
              },
            },
          },
        },
        intakes: true,
        prescriptions: true,
        orders: true,
        treatmentPlans: true,
        labRequests: {
          include: {
            results: true,
          },
        },
        dietPlans: {
          include: {
            adherenceLogs: true,
          },
        },
        progressEntries: true,
        professionals: {
          include: {
            professional: {
              select: {
                fullName: true,
                registrationNum: true,
                regBody: true,
                specialisation: true,
              },
            },
          },
        },
        messages: true,
        consultationNotes: true,
      },
    });

    if (!record) {
      throw new AppError("Patient not found.", 404);
    }

    // Decrypt PII fields on the patient record
    const decryptedProfile = this.decryptPatientPii(record as PatientRecord);

    // Decrypt intake responses
    const intakes = record.intakes.map((intake) => {
      let responses = null;
      if (intake.responsesEnc) {
        try {
          responses = JSON.parse(Crypto.decrypt(intake.responsesEnc));
        } catch {
          responses = intake.responsesEnc; // return raw if decryption fails
        }
      }
      return { ...intake, responsesEnc: undefined, responses };
    });

    // Decrypt message content
    const messages = record.messages.map((msg) => {
      let content = null;
      if (msg.contentEnc) {
        try {
          content = Crypto.decrypt(msg.contentEnc);
        } catch {
          content = msg.contentEnc;
        }
      }
      return { ...msg, contentEnc: undefined, content };
    });

    // Decrypt consultation note content
    const consultationNotes = record.consultationNotes.map((note) => {
      let content = null;
      if (note.contentEnc) {
        try {
          content = Crypto.decrypt(note.contentEnc);
        } catch {
          content = note.contentEnc;
        }
      }
      return { ...note, contentEnc: undefined, content };
    });

    // Fetch audit logs for this patient
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: "Patient", entityId: patientId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    });

    // Log the NDPR export event
    await prisma.auditLog.create({
      data: {
        userId: record.userId,
        action: "NDPR_DATA_EXPORT",
        entityType: "Patient",
        entityId: patientId,
      },
    });

    const exportedAt = new Date().toISOString();

    return {
      exportedAt,
      dataSubject: {
        email: record.user.email,
        phone: record.user.phone,
      },
      recordTypes: [
        "user",
        "patient",
        "subscriptions",
        "intakes",
        "prescriptions",
        "orders",
        "treatmentPlans",
        "labRequests",
        "dietPlans",
        "progressEntries",
        "professionalAssignments",
        "messages",
        "consultationNotes",
        "auditLogs",
      ],
      records: {
        user: record.user,
        patient: {
          ...record,
          ...decryptedProfile,
          // Remove encrypted columns from export
          firstNameEnc: undefined,
          lastNameEnc: undefined,
          genderEnc: undefined,
          dobEnc: undefined,
          addressEnc: undefined,
          stateOfResidenceEnc: undefined,
        },
        subscriptions: record.subscriptions,
        intakes,
        prescriptions: record.prescriptions,
        orders: record.orders,
        treatmentPlans: record.treatmentPlans,
        labRequests: record.labRequests,
        dietPlans: record.dietPlans,
        progressEntries: record.progressEntries,
        professionalAssignments: record.professionals,
        messages,
        consultationNotes,
        auditLogs,
      },
    };
  }

  // ── NDPR: Deletion Request ───────────────────────────────────

  // NDPR right to erasure / deletion
  async requestDeletion(patientId: string) {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: { user: { select: { email: true, isActive: true } } },
    });

    if (!patient) {
      throw new AppError("Patient not found.", 404);
    }

    // Idempotent: if already requested, return current status
    if (
      patient.accountStatus === "DELETION_REQUESTED" ||
      patient.accountStatus === "DELETION_SCHEDULED"
    ) {
      return {
        message: "Your data deletion request has already been submitted.",
        accountStatus: patient.accountStatus,
        scheduledForDeletionAt: patient.scheduledForDeletionAt,
      };
    }

    const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id: patientId },
        data: {
          accountStatus: "DELETION_REQUESTED",
          scheduledForDeletionAt: thirtyDaysOut,
        },
      });

      await tx.user.update({
        where: { id: patient.userId },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          userId: patient.userId,
          action: "NDPR_DELETION_REQUESTED",
          entityType: "Patient",
          entityId: patientId,
          metadata: JSON.stringify({
            scheduledForDeletionAt: thirtyDaysOut.toISOString(),
            gracePeriodDays: 30,
          }),
        },
      });
    });

    // Notify the patient via email
    try {
      await Email.sendDeletionConfirmation(patient.user.email, thirtyDaysOut);
    } catch (err) {
      logger.error({ err }, "Failed to send deletion confirmation email");
    }

    logger.info(
      `[PATIENT] Deletion requested for patient ${patientId}, scheduled ${thirtyDaysOut.toISOString()}`
    );

    return {
      message:
        "Your data deletion request has been received. Your data will be permanently erased after a 30-day grace period.",
      accountStatus: "DELETION_REQUESTED",
      scheduledForDeletionAt: thirtyDaysOut,
    };
  }

  // ── NDPR: Data Correction ────────────────────────────────────

  // NDPR right to rectification.
  async correctData(
    patientId: string,
    corrections: Record<string, unknown>,
    reason: string,
    requestingUserId: string
  ) {
    // Verify access (patient must be correcting their own data)
    const access = await this.checkAccess(patientId, requestingUserId);
    if (access.role !== "PATIENT" && access.role !== "ADMIN" && access.role !== "SUPER_ADMIN") {
      throw new AppError("Only the patient or an administrator can request data corrections.", 403);
    }

    // Validate correction field names
    const invalidFields = Object.keys(corrections).filter(
      (key) => !(CORRECTABLE_FIELDS as readonly string[]).includes(key)
    );
    if (invalidFields.length > 0) {
      throw new AppError(
        `Invalid correction fields: ${invalidFields.join(", ")}. Allowed fields: ${CORRECTABLE_FIELDS.join(", ")}`,
        400
      );
    }

    // Fetch current (decrypted) values
    const record = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!record) {
      throw new AppError("Patient not found.", 404);
    }

    const currentProfile = this.decryptPatientPii(record as PatientRecord);
    const currentValues: Record<string, unknown> = {
      ...currentProfile,
      marketingOptIn: record.marketingOptIn,
    };

    // Build before/after snapshots for auditable fields
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    for (const field of Object.keys(corrections)) {
      before[field] = currentValues[field] ?? null;
      after[field] = corrections[field];
    }

    // Build encrypted update data for PII fields + handle marketingOptIn
    const updateData: Record<string, unknown> = {};

    for (const field of Object.keys(corrections)) {
      const value = corrections[field];

      if (field === "marketingOptIn") {
        updateData.marketingOptIn = value;
      } else if (field === "dob") {
        updateData.dobEnc = Crypto.encrypt(value as string);
      } else {
        const encKey = `${field}Enc`;
        updateData[encKey] = Crypto.encrypt(value as string);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id: patientId },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          userId: requestingUserId,
          action: "NDPR_DATA_CORRECTION",
          entityType: "Patient",
          entityId: patientId,
          metadata: JSON.stringify({
            reason,
            before,
            after,
            correctedFields: Object.keys(corrections),
          }),
        },
      });
    });

    logger.info(
      `[PATIENT] Data correction for patient ${patientId}: ${Object.keys(corrections).join(", ")}`
    );

    return this.getProfile(patientId, requestingUserId);
  }
}
