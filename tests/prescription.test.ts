import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("Clinical Prescriptions Integration Tests", () => {
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const patientEmail = `pat-rx-${randomSuffix}@example.com`;
  const doctorEmail = `doc-rx-${randomSuffix}@example.com`;

  let patientToken: string;
  let doctorToken: string;

  let patientId: string;
  let doctorId: string;
  let userId: string;
  let doctorUserId: string;
  let subscriptionId: string;
  let pharmacyId: string;

  let activePrescriptionId: string;

  it("Preparation: Register & Setup Entities", async () => {
    // 1. Register Patient
    let res = await request(app).post("/api/auth/register").send({
      email: patientEmail,
      password: "Password123!",
      firstName: "James",
      lastName: "Patient",
      ndprConsent: true,
    });
    expect(res.status).toBe(201);
    patientToken = res.body.data.accessToken;

    const patientUser = await prisma.user.findUnique({ where: { email: patientEmail } });
    userId = patientUser!.id;
    await request(app).post(`/api/auth/verify-email/${patientUser?.emailVerificationToken}`);

    res = await request(app).post("/api/auth/login").send({ email: patientEmail, password: "Password123!" });
    patientToken = res.body.data.accessToken;

    // Create Patient Profile
    res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        firstName: "James",
        lastName: "Patient",
        gender: "MALE",
        dob: "1990-01-01",
        address: "123 Health Street",
        stateOfResidence: "Lagos",
        marketingOptIn: false,
      });
    expect(res.status).toBe(201);
    patientId = res.body.data.patientId;

    // Create Subscription
    const subscription = await prisma.subscription.create({
      data: {
        patientId,
        vertical: "WEIGHT_LOSS",
        planCode: "WL_CORE",
        status: "ACTIVE",
        amount: 55000,
        billingDay: 1,
      },
    });
    subscriptionId = subscription.id;

    // 2. Register Doctor
    res = await request(app).post("/api/auth/register").send({
      email: doctorEmail,
      password: "Password123!",
      firstName: "DrJane",
      lastName: "Prescriber",
      ndprConsent: true,
    });
    expect(res.status).toBe(201);

    const doctorUser = await prisma.user.findUnique({ where: { email: doctorEmail } });
    doctorUserId = doctorUser!.id;
    await request(app).post(`/api/auth/verify-email/${doctorUser?.emailVerificationToken}`);

    // Log in fresh while mfaEnabled is false to bypass login TOTP gate
    res = await request(app).post("/api/auth/login").send({ email: doctorEmail, password: "Password123!" });
    doctorToken = res.body.data.accessToken;

    // Verify and elevate Doctor
    await prisma.user.update({
      where: { id: doctorUserId },
      data: { role: "DOCTOR", mfaEnabled: true },
    });

    const profProfile = await prisma.professionalProfile.create({
      data: {
        userId: doctorUserId,
        fullName: "Dr. Jane Prescriber",
        registrationNum: `MDCN-${randomSuffix}`,
        regBody: "MDCN",
        status: "VERIFIED",
      },
    });
    doctorId = profProfile.id;

    // 3. Register Active Pharmacy
    const pharmacy = await prisma.pharmacy.create({
      data: {
        name: "Heliocare Dispensing Central Pharmacy",
        pcnLicence: `PCN-RX-${randomSuffix}`,
        address: "456 Pharmacist Avenue",
        canCompound: true,
        cities: JSON.stringify(["Lagos"]),
        isActive: true,
      },
    });
    pharmacyId = pharmacy.id;
  });

  it("Step 1: Standard (Non-GLP-1) Prescription Issuance", async () => {
    const response = await request(app)
      .post("/api/prescriptions")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        patientId,
        subscriptionId,
        drugName: "Metformin",
        doseMg: 500,
        frequency: "Twice daily with meals",
        quantity: 60,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

    if (response.status !== 201) console.log("Standard Rx Issuance Error:", response.body);
    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data.status).toBe("ACTIVE");
    expect(response.body.data.pdfS3Key).toBeDefined();

    activePrescriptionId = response.body.data.id;
  }, 15000);

  it("Step 2: Secured PDF Redirect (302 Found)", async () => {
    const response = await request(app)
      .get(`/api/prescriptions/${activePrescriptionId}/pdf`)
      .set("Authorization", `Bearer ${patientToken}`);

    expect(response.status).toBe(302);
    expect(response.header.location).toContain("mock-signature=true");
  });

  it("Step 3: GLP-1 Lab Requirement Gate (Blocked/Unblocked)", async () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // A. Should be BLOCKED because patient does not have a LabResult
    let response = await request(app)
      .post("/api/prescriptions")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        patientId,
        subscriptionId,
        drugName: "Semaglutide (Ozempic)",
        doseMg: 0.25,
        frequency: "Once weekly",
        quantity: 4,
        expiresAt,
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("GLP-1 weight loss prescriptions are strictly blocked");

    // B. Seed a finalized LabResult
    const labRequest = await prisma.labTestRequest.create({
      data: {
        patientId,
        professionalId: doctorId,
        testCodes: JSON.stringify(["HbA1c"]),
        status: "COMPLETED",
      },
    });

    await prisma.labResult.create({
      data: {
        requestId: labRequest.id,
        testName: "HbA1c",
        value: "5.8",
        flag: "NORMAL",
      },
    });

    // C. Should succeed now that a LabResult exists
    response = await request(app)
      .post("/api/prescriptions")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        patientId,
        subscriptionId,
        drugName: "Semaglutide (Ozempic)",
        doseMg: 0.25,
        frequency: "Once weekly",
        quantity: 4,
        expiresAt,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("ACTIVE");
    expect(response.body.data.drugName).toBe("Semaglutide (Ozempic)");
  });

  it("Step 4: Dose Escalation Flow", async () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Escalate Metformin from 500mg to 1000mg
    const response = await request(app)
      .post("/api/prescriptions")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        patientId,
        subscriptionId,
        drugName: "Metformin",
        doseMg: 1000,
        frequency: "Twice daily with meals",
        quantity: 60,
        expiresAt,
        previousPrescriptionId: activePrescriptionId,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.version).toBe(2);
    expect(response.body.data.parentId).toBe(activePrescriptionId);

    // Verify previous prescription is now EXPIRED
    const prevPrescription = await prisma.prescription.findUnique({
      where: { id: activePrescriptionId },
    });
    expect(prevPrescription?.status).toBe("EXPIRED");

    activePrescriptionId = response.body.data.id;
  });

  it("Step 5: Secure Prescription Cancellation", async () => {
    // A. Should reject cancellation without a valid reason
    let response = await request(app)
      .post(`/api/prescriptions/${activePrescriptionId}/cancel`)
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({ reason: "too short" });

    expect(response.status).toBe(400);

    // B. Cancel successfully with a valid reason
    response = await request(app)
      .post(`/api/prescriptions/${activePrescriptionId}/cancel`)
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({ reason: "Patient reported severe hypersensitivity side effects." });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("CANCELLED");
    expect(response.body.data.cancellationReason).toBe("Patient reported severe hypersensitivity side effects.");

    // C. Verify physical deletes are blocked
    const cancelledRx = await prisma.prescription.findUnique({
      where: { id: activePrescriptionId },
    });
    expect(cancelledRx).not.toBeNull();
    expect(cancelledRx?.status).toBe("CANCELLED");
  });

  afterAll(async () => {
    const userIds = [userId, doctorUserId].filter(Boolean);

    // Database Cleanup Constraint Resolution
    await prisma.auditLog.deleteMany({
      where: { userId: { in: userIds } },
    });
    if (patientId) {
      await prisma.labResult.deleteMany({
        where: { request: { patientId } },
      });
      await prisma.labTestRequest.deleteMany({
        where: { patientId },
      });
      await prisma.prescription.deleteMany({
        where: { patientId },
      });
      await prisma.subscription.deleteMany({
        where: { patientId },
      });
      await prisma.patientProfessional.deleteMany({
        where: { patientId },
      });
    }
    await prisma.professionalProfile.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.patient.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    if (pharmacyId) {
      await prisma.pharmacy.deleteMany({
        where: { id: pharmacyId },
      });
    }
  });
});
