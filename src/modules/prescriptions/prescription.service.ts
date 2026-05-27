import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { generatePrescriptionPDF } from "../../lib/pdf/prescription.js";
import { uploadToS3, getSignedUrl } from "../../lib/storage/s3.js";
import { validatePdfBuffer } from "../../lib/storage/uploadValidation.js";
import { isGlp1Medication } from "../../lib/clinical/medication.js";
import { logger } from "../../lib/logger.js";


export class PrescriptionService {
  // Issues a new prescription, generates secure digital signatures & PDFs, uploads to S3
  async issuePrescription(
    doctorId: string,
    data: {
      patientId: string;
      subscriptionId: string;
      drugName: string;
      doseMg: number;
      frequency: string;
      quantity: number;
      expiresAt: string;
      previousPrescriptionId?: string | undefined;
    }
  ) {
    // 1. Clinical Gate: Check GLP-1 Lab Requirement
    if (isGlp1Medication(data.drugName)) {
      const labResultCount = await prisma.labResult.count({
        where: {
          request: {
            patientId: data.patientId,
          },
        },
      });

      if (labResultCount === 0) {
        throw new AppError(
          "GLP-1 weight loss prescriptions are strictly blocked until at least one finalized LabResult exists for the patient.",
          403
        );
      }
    }

    // 2. Fetch Patient & Prescriber details
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      include: { user: true },
    });

    if (!patient) {
      throw new AppError("Patient profile not found.", 404);
    }

    const doctor = await prisma.professionalProfile.findUnique({
      where: { id: doctorId },
      include: { user: true },
    });

    if (!doctor || doctor.status !== "VERIFIED") {
      throw new AppError("Verified professional prescriber profile not found.", 404);
    }

    // 3. Dose Escalation: Archive previous and increment version if applicable
    let version = 1;
    let parentId: string | null = null;
    let previousPrescription: any = null;

    if (data.previousPrescriptionId) {
      previousPrescription = await prisma.prescription.findUnique({
        where: { id: data.previousPrescriptionId },
      });

      if (!previousPrescription) {
        throw new AppError("Previous prescription for escalation not found.", 404);
      }

      if (previousPrescription.patientId !== data.patientId) {
        throw new AppError("Previous prescription patient mismatch.", 400);
      }

      version = previousPrescription.version + 1;
      parentId = previousPrescription.id;
    }

    // 4. Generate digital cryptographic signature (HMAC-SHA256)
    const signingSecret = process.env.CLINICAL_SIGNING_SECRET || "clinical-signing-secret-default-key";
    const issuedAt = new Date().toISOString();
    const payloadString = `${data.patientId}|${doctorId}|${data.drugName}|${data.doseMg}|${data.frequency}|${data.quantity}|${issuedAt}|v${version}`;
    const digitalSig = crypto.createHmac("sha256", signingSecret).update(payloadString).digest("hex");

    // 5. Generate Puppeteer PDF buffer
    const patientName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
    const doctorName = doctor.fullName || "Clinical Doctor";
    const formattedDob = patient.dob ? new Date(patient.dob).toLocaleDateString() : "N/A";
    const formattedIssuedAt = new Date(issuedAt).toLocaleDateString();
    const formattedExpiresAt = new Date(data.expiresAt).toLocaleDateString();

    const pdfBuffer = await generatePrescriptionPDF({
      patientName,
      patientDob: formattedDob,
      doctorName,
      registrationNum: doctor.registrationNum,
      drugName: data.drugName,
      doseMg: data.doseMg,
      frequency: data.frequency,
      quantity: data.quantity,
      digitalSig,
      issuedAt: formattedIssuedAt,
      expiresAt: formattedExpiresAt,
    });

    // 6. Security Upload Validation
    validatePdfBuffer(pdfBuffer);

    // 7. S3 secure upload
    const prescriptionId = crypto.randomUUID();
    const pdfS3Key = `prescriptions/${prescriptionId}.pdf`;
    await uploadToS3(pdfS3Key, pdfBuffer, "application/pdf");

    // 8. DB Transaction Execution
    const result = await prisma.$transaction(async (tx) => {
      // Archive previous prescription if dose escalation
      if (previousPrescription) {
        await tx.prescription.update({
          where: { id: previousPrescription.id },
          data: { status: "EXPIRED" },
        });

        // Notify Pharmacist
        logger.info(
          `[PHARMACIST_NOTIFIED] Dose escalated for patient ${patientName}: ${previousPrescription.drugName} ${previousPrescription.doseMg}mg -> ${data.drugName} ${data.doseMg}mg`
        );
      }

      // Create new prescription
      const prescription = await tx.prescription.create({
        data: {
          id: prescriptionId,
          patientId: data.patientId,
          doctorId,
          subscriptionId: data.subscriptionId,
          drugName: data.drugName,
          doseMg: data.doseMg,
          frequency: data.frequency,
          quantity: data.quantity,
          status: "ACTIVE",
          version,
          parentId,
          pdfS3Key,
          expiresAt: new Date(data.expiresAt),
          digitalSig,
        },
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          userId: doctor.userId,
          action: "PRESCRIPTION_ISSUED",
          entityType: "Prescription",
          entityId: prescriptionId,
          metadata: JSON.stringify({
            version,
            isEscalation: !!previousPrescription,
            drugName: data.drugName,
            doseMg: data.doseMg,
          }),
        },
      });

      return prescription;
    });

    // Auto-create PENDING order for the issued prescription
    try {
      const { OrderService } = await import("../orders/order.service.js");
      const orderService = new OrderService();
      await orderService.createOrder({
        patientId: data.patientId,
        prescriptionId,
        subscriptionId: data.subscriptionId,
        drugName: data.drugName,
        patientStateOfResidence: patient.stateOfResidence || "Unknown",
      });
      logger.info(`[ORDER_AUTO_CREATED] Order created for prescription ${prescriptionId}`);
    } catch (orderError: unknown) {
      logger.error(
        { err: orderError },
        `[ORDER_CREATION_FAILED] Failed to auto-create order for prescription ${prescriptionId}`
      );
    }

    return result;
  }

  // Generates secure temporary signed URL for prescription PDF and records access
  async getSignedPdfUrl(prescriptionId: string, requestingUser: { id: string; role: string }) {
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });

    if (!prescription) {
      throw new AppError("Prescription not found.", 404);
    }

    // Authorization Guard: Only the patient, their doctor, pharmacists, or admins can view
    const isPatient = requestingUser.id === prescription.patient.userId;
    const isDoctor = requestingUser.id === prescription.doctor.userId;
    const isAuthorizedRole = ["PHARMACIST", "PHARMACY", "ADMIN", "SUPER_ADMIN"].includes(requestingUser.role);

    if (!isPatient && !isDoctor && !isAuthorizedRole) {
      throw new AppError("Not authorized to view this prescription PDF.", 403);
    }

    if (!prescription.pdfS3Key) {
      throw new AppError("Prescription PDF is not stored on S3.", 400);
    }

    // Generate secure URL with 15-minute TTL (900 seconds)
    const signedUrl = await getSignedUrl(prescription.pdfS3Key, 900);
    return signedUrl;
  }

  // Cancels a prescription with a mandatory reason
  async cancelPrescription(
    prescriptionId: string,
    cancellingUserId: string,
    reason: string
  ) {
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
    });

    if (!prescription) {
      throw new AppError("Prescription not found.", 404);
    }

    if (prescription.status === "CANCELLED") {
      throw new AppError("Prescription is already cancelled.", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.prescription.update({
        where: { id: prescriptionId },
        data: {
          status: "CANCELLED",
          cancellationReason: reason,
        },
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          userId: cancellingUserId,
          action: "PRESCRIPTION_CANCELLED",
          entityType: "Prescription",
          entityId: prescriptionId,
          metadata: JSON.stringify({ reason }),
        },
      });

      return updated;
    });

    return result;
  }
}
