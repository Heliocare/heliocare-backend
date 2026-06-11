import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { Crypto } from "../src/utils/crypto.js";

describe("Patient Module Integration Tests", () => {
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const patientEmail = `pat-${randomSuffix}@example.com`;
  const patient2Email = `pat2-${randomSuffix}@example.com`;
  const doctorEmail = `doc-${randomSuffix}@example.com`;

  let patientToken: string;
  let patientId: string;
  let patientUserId: string;

  let patient2Token: string;
  let patient2Id: string;

  let doctorToken: string;
  let doctorUserId: string;
  let doctorProfileId: string;

  // ── Preparation ──────────────────────────────────────────────

  it("Prep: Register Patient 1, verify email, complete onboarding", async () => {
    // Register
    let res = await request(app).post("/api/auth/register").send({
      email: patientEmail,
      password: "Password123!",
      firstName: "Alice",
      lastName: "Patient",
      ndprConsent: true,
    });
    expect(res.status).toBe(201);

    // Verify email
    const user = await prisma.user.findUnique({ where: { email: patientEmail } });
    patientUserId = user!.id;
    await request(app).post(`/api/auth/verify-email/${user?.emailVerificationToken}`);

    // Login for token
    res = await request(app).post("/api/auth/login").send({
      email: patientEmail,
      password: "Password123!",
    });
    expect(res.status).toBe(200);
    patientToken = res.body.data.accessToken;

    // Complete onboarding (also writes encrypted PII)
    res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        firstName: "Alice",
        lastName: "Patient",
        gender: "FEMALE",
        dob: "1992-05-15",
        address: "42 Main Street, Ikoyi",
        stateOfResidence: "Lagos",
        marketingOptIn: false,
      });
    expect(res.status).toBe(201);
    patientId = res.body.data.patientId;
  });

  it("Prep: Register Patient 2 (no onboarding — for auth tests)", async () => {
    let res = await request(app).post("/api/auth/register").send({
      email: patient2Email,
      password: "Password123!",
      firstName: "Bob",
      lastName: "Other",
      ndprConsent: true,
    });
    expect(res.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: patient2Email } });
    await request(app).post(`/api/auth/verify-email/${user?.emailVerificationToken}`);

    res = await request(app).post("/api/auth/login").send({
      email: patient2Email,
      password: "Password123!",
    });
    patient2Token = res.body.data.accessToken;

    const patient = await prisma.patient.findUnique({ where: { userId: user!.id } });
    patient2Id = patient!.id;
  });

  it("Prep: Create Doctor with professional profile & assign to Patient 1", async () => {
    // Register doctor via public register (creates User + placeholder Patient)
    let res = await request(app).post("/api/auth/register").send({
      email: doctorEmail,
      password: "Password123!",
      firstName: "Doc",
      lastName: "Professional",
      ndprConsent: true,
    });
    expect(res.status).toBe(201);

    const docUser = await prisma.user.findUnique({ where: { email: doctorEmail } });
    doctorUserId = docUser!.id;
    await request(app).post(`/api/auth/verify-email/${docUser?.emailVerificationToken}`);

    // Login BEFORE role change + mfa enable (like professional test)
    res = await request(app).post("/api/auth/login").send({
      email: doctorEmail,
      password: "Password123!",
    });
    doctorToken = res.body.data.accessToken;

    // Upgrade to DOCTOR + enable MFA
    await prisma.user.update({
      where: { id: doctorUserId },
      data: { role: "DOCTOR", mfaEnabled: true },
    });

    // Delete the auto-created Patient record for the doctor (we want them as a professional only)
    await prisma.patient.deleteMany({ where: { userId: doctorUserId } });

    // Create professional profile directly
    const profile = await prisma.professionalProfile.create({
      data: {
        userId: doctorUserId,
        fullName: "Dr. Test Professional",
        registrationNum: `MDCN-${randomSuffix}`,
        regBody: "MDCN",
        status: "VERIFIED",
        isAvailable: true,
        maxOpenConsults: 25,
      },
    });
    doctorProfileId = profile.id;

    // Assign doctor to Patient 1
    await prisma.patientProfessional.create({
      data: {
        patientId,
        professionalId: doctorProfileId,
      },
    });
  });

  // ── Step 1: Get Own Profile ──────────────────────────────────

  it("Step 1: GET /me returns own profile with decrypted PII", async () => {
    const res = await request(app)
      .get("/api/patients/me")
      .set("Authorization", `Bearer ${patientToken}`);

    if (res.status !== 200) console.log("Step 1 Error:", res.body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data).toHaveProperty("profile");
    expect(res.body.data).toHaveProperty("account");
    expect(res.body.data).toHaveProperty("summary");

    // Decrypted PII fields
    expect(res.body.data.profile.firstName).toBe("Alice");
    expect(res.body.data.profile.lastName).toBe("Patient");
    expect(res.body.data.profile.gender).toBe("FEMALE");
    expect(res.body.data.profile.dob).toBe("1992-05-15");
    expect(res.body.data.profile.address).toBe("42 Main Street, Ikoyi");
    expect(res.body.data.profile.stateOfResidence).toBe("Lagos");

    // Account fields
    expect(res.body.data.account.marketingOptIn).toBe(false);
    expect(res.body.data.account.accountStatus).toBe("PENDING_INTAKE");
    expect(res.body.data.account.ndprConsentAt).toBeTruthy();

    // Summary
    expect(res.body.data.summary).toHaveProperty("activeSubscriptions");
    expect(res.body.data.summary).toHaveProperty("latestIntakeStatus");
  });

  // ── Step 1b: Verify PII is encrypted at rest ─────────────────

  it("Step 1b: PII fields are stored encrypted in the database", async () => {
    const record = await prisma.patient.findUnique({ where: { id: patientId } });

    expect(record).not.toBeNull();
    // Encrypted columns should be populated (onboarding dual-writes)
    expect(record!.firstNameEnc).toBeTruthy();
    expect(record!.lastNameEnc).toBeTruthy();
    expect(record!.genderEnc).toBeTruthy();
    expect(record!.dobEnc).toBeTruthy();
    expect(record!.addressEnc).toBeTruthy();
    expect(record!.stateOfResidenceEnc).toBeTruthy();

    // Verify round-trip: decrypt DB value matches plaintext
    expect(Crypto.decrypt(record!.firstNameEnc!)).toBe("Alice");
    expect(Crypto.decrypt(record!.lastNameEnc!)).toBe("Patient");
    expect(Crypto.decrypt(record!.genderEnc!)).toBe("FEMALE");
    expect(Crypto.decrypt(record!.dobEnc!)).toBe("1992-05-15");
    expect(Crypto.decrypt(record!.addressEnc!)).toBe("42 Main Street, Ikoyi");
    expect(Crypto.decrypt(record!.stateOfResidenceEnc!)).toBe("Lagos");
  });

  // ── Step 2: Update Own Profile ───────────────────────────────

  it("Step 2: PATCH /me updates own profile and re-encrypts PII", async () => {
    const res = await request(app)
      .patch("/api/patients/me")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        firstName: "Alicia",
        address: "55 New Avenue, Victoria Island",
        marketingOptIn: true,
      });

    if (res.status !== 200) console.log("Step 2 Error:", res.body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toContain("updated");

    // Verify response has updated fields
    expect(res.body.data.profile.firstName).toBe("Alicia");
    expect(res.body.data.profile.address).toBe("55 New Avenue, Victoria Island");
    expect(res.body.data.account.marketingOptIn).toBe(true);

    // Unchanged fields remain
    expect(res.body.data.profile.lastName).toBe("Patient");
    expect(res.body.data.profile.gender).toBe("FEMALE");

    // Verify encrypted in DB
    const record = await prisma.patient.findUnique({ where: { id: patientId } });
    expect(Crypto.decrypt(record!.firstNameEnc!)).toBe("Alicia");
    expect(Crypto.decrypt(record!.addressEnc!)).toBe("55 New Avenue, Victoria Island");
    // Unchanged field still has original encrypted value
    expect(Crypto.decrypt(record!.lastNameEnc!)).toBe("Patient");
  });

  it("Step 2b: PATCH /me with no fields returns 400", async () => {
    const res = await request(app)
      .patch("/api/patients/me")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("No fields");
  });

  // ── Step 3: NDPR Data Export ──────────────────────────────────

  it("Step 3: GET /me/export returns comprehensive NDPR data export", async () => {
    const res = await request(app)
      .get("/api/patients/me/export")
      .set("Authorization", `Bearer ${patientToken}`);

    if (res.status !== 200) console.log("Step 3 Error:", res.body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");

    const data = res.body.data;
    expect(data).toHaveProperty("exportedAt");
    expect(data).toHaveProperty("dataSubject");
    expect(data).toHaveProperty("recordTypes");
    expect(data).toHaveProperty("records");

    // Verify data subject
    expect(data.dataSubject.email).toBe(patientEmail);

    // Verify record types are present
    const expectedTypes = [
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
    ];
    for (const type of expectedTypes) {
      expect(data.recordTypes).toContain(type);
    }

    // User record should not have sensitive fields
    expect(data.records.user).not.toHaveProperty("password");
    expect(data.records.user).not.toHaveProperty("passwordResetToken");
    expect(data.records.user).not.toHaveProperty("emailVerificationToken");

    // Patient record should have decrypted PII (no _Enc fields in export)
    expect(data.records.patient.firstName).toBe("Alicia");
    expect(data.records.patient.firstNameEnc).toBeUndefined();
  });

  // ── Step 4: NDPR Data Correction ─────────────────────────────

  it("Step 4: PATCH /me/correct corrects data with before/after audit", async () => {
    const res = await request(app)
      .patch("/api/patients/me/correct")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        corrections: {
          lastName: "CorrectedPatient",
          stateOfResidence: "Abuja",
        },
        reason: "Legal name change and relocation to FCT",
      });

    if (res.status !== 200) console.log("Step 4 Error:", res.body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toContain("correction");

    // Verify profile reflects corrections
    expect(res.body.data.profile.lastName).toBe("CorrectedPatient");
    expect(res.body.data.profile.stateOfResidence).toBe("Abuja");

    // Unchanged fields remain
    expect(res.body.data.profile.firstName).toBe("Alicia");

    // Verify audit log was written with before/after
    const auditLog = await prisma.auditLog.findFirst({
      where: { action: "NDPR_DATA_CORRECTION", entityId: patientId },
      orderBy: { createdAt: "desc" },
    });

    expect(auditLog).not.toBeNull();
    const metadata = JSON.parse(auditLog!.metadata!);
    expect(metadata.reason).toBe("Legal name change and relocation to FCT");
    expect(metadata.before.lastName).toBe("Patient");
    expect(metadata.after.lastName).toBe("CorrectedPatient");
    expect(metadata.before.stateOfResidence).toBe("Lagos");
    expect(metadata.after.stateOfResidence).toBe("Abuja");
    expect(metadata.correctedFields).toContain("lastName");
    expect(metadata.correctedFields).toContain("stateOfResidence");
  });

  it("Step 4b: PATCH /me/correct with invalid field returns 400", async () => {
    const res = await request(app)
      .patch("/api/patients/me/correct")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        corrections: { email: "hacked@evil.com" }, // not in correctable list
        reason: "Attempting to change a non-correctable field",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid correction fields");
  });

  it("Step 4c: PATCH /me/correct with empty corrections returns 400", async () => {
    const res = await request(app)
      .patch("/api/patients/me/correct")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        corrections: {},
        reason: "No actual corrections provided for this request",
      });

    expect(res.status).toBe(400);
  });

  it("Step 4d: PATCH /me/correct with short reason returns 400", async () => {
    const res = await request(app)
      .patch("/api/patients/me/correct")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        corrections: { firstName: "Test" },
        reason: "Short", // less than 10 characters
      });

    expect(res.status).toBe(400);
  });

  // ── Step 5: Authorization ────────────────────────────────────

  it("Step 5: Patient 2 cannot access Patient 1 via GET /:id", async () => {
    // GET /:id is restricted to DOCTOR, DIETITIAN, ADMIN, SUPER_ADMIN
    // PATIENT role should get 403
    const res = await request(app)
      .get(`/api/patients/${patientId}`)
      .set("Authorization", `Bearer ${patient2Token}`);

    expect(res.status).toBe(403);
  });

  it("Step 5b: Assigned Doctor can access patient via GET /:id", async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}`)
      .set("Authorization", `Bearer ${doctorToken}`);

    if (res.status !== 200) console.log("Step 5b Error:", res.body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    // Verify decrypted PII is visible to the professional
    expect(res.body.data.profile.firstName).toBe("Alicia");
    expect(res.body.data.profile.lastName).toBe("CorrectedPatient");
  });

  it("Step 5c: Non-patient (doctor) cannot PATCH /me", async () => {
    const res = await request(app)
      .patch("/api/patients/me")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({ firstName: "Hacked" });

    // Should fail because doctor has no Patient record (we deleted it during setup)
    // or because the route restricts to PATIENT
    expect(res.status).not.toBe(200);
  });

  it("Step 5d: Unauthenticated requests are rejected", async () => {
    const res = await request(app).get("/api/patients/me");

    expect(res.status).toBe(401);
  });

  // ── Step 6: NDPR Deletion Request ────────────────────────────

  it("Step 6: DELETE /me submits NDPR deletion request", async () => {
    const res = await request(app)
      .delete("/api/patients/me")
      .set("Authorization", `Bearer ${patientToken}`);

    if (res.status !== 200) console.log("Step 6 Error:", res.body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.accountStatus).toBe("DELETION_REQUESTED");
    expect(res.body.scheduledForDeletionAt).toBeTruthy();

    // Verify scheduled date is roughly 30 days out
    const scheduledAt = new Date(res.body.scheduledForDeletionAt);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const diffDays = Math.abs(
      (scheduledAt.getTime() - thirtyDaysFromNow.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBeLessThan(1); // within 1 day

    // Verify DB state
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    expect(patient!.accountStatus).toBe("DELETION_REQUESTED");
    expect(patient!.scheduledForDeletionAt).toBeTruthy();

    // User should be deactivated
    const user = await prisma.user.findUnique({ where: { email: patientEmail } });
    expect(user!.isActive).toBe(false);

    // Audit log should exist
    const auditLog = await prisma.auditLog.findFirst({
      where: { action: "NDPR_DELETION_REQUESTED", entityId: patientId },
    });
    expect(auditLog).not.toBeNull();
    const metadata = JSON.parse(auditLog!.metadata!);
    expect(metadata.gracePeriodDays).toBe(30);
  });

  it("Step 6b: DELETE /me blocks subsequent requests after deactivation", async () => {
    // First deletion for Patient 2 — should succeed
    const res1 = await request(app)
      .delete("/api/patients/me")
      .set("Authorization", `Bearer ${patient2Token}`);

    expect(res1.status).toBe(200);
    expect(res1.body.accountStatus).toBe("DELETION_REQUESTED");

    // Second attempt — user is now inactive, middleware blocks it
    const res2 = await request(app)
      .delete("/api/patients/me")
      .set("Authorization", `Bearer ${patient2Token}`);

    expect(res2.status).toBe(403);
    expect(res2.body.message).toContain("inactive");
  });

  // ── Step 7: Profile view audit log exists ────────────────────

  it("Step 7: Audit log records profile views", async () => {
    const viewLogs = await prisma.auditLog.findMany({
      where: { action: "PATIENT_PROFILE_VIEWED", entityId: patientId },
    });

    expect(viewLogs.length).toBeGreaterThan(0);
  });

  // ── Cleanup ──────────────────────────────────────────────────

  afterAll(async () => {
    try {
      const p1User = await prisma.user.findUnique({ where: { email: patientEmail } });
      const p2User = await prisma.user.findUnique({ where: { email: patient2Email } });
      const dUser = await prisma.user.findUnique({ where: { email: doctorEmail } });

      // Clean up Patient 1
      if (p1User) {
        await prisma.intake.deleteMany({ where: { patientId: p1User.patient?.id } });
        await prisma.patientProfessional.deleteMany({ where: { patientId: p1User.patient?.id } });
        await prisma.auditLog.deleteMany({ where: { userId: p1User.id } });
        await prisma.patient.deleteMany({ where: { userId: p1User.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: p1User.id } });
        await prisma.user.delete({ where: { id: p1User.id } });
      }

      // Clean up Patient 2
      if (p2User) {
        await prisma.patientProfessional.deleteMany({ where: { patientId: p2User.patient?.id } });
        await prisma.auditLog.deleteMany({ where: { userId: p2User.id } });
        await prisma.patient.deleteMany({ where: { userId: p2User.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: p2User.id } });
        await prisma.user.delete({ where: { id: p2User.id } });
      }

      // Clean up Doctor
      if (dUser) {
        await prisma.patientProfessional.deleteMany({ where: { professionalId: doctorProfileId } });
        await prisma.auditLog.deleteMany({ where: { userId: dUser.id } });
        await prisma.professionalProfile.deleteMany({ where: { userId: dUser.id } });
        await prisma.patient.deleteMany({ where: { userId: dUser.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: dUser.id } });
        await prisma.user.delete({ where: { id: dUser.id } });
      }
    } catch (e) {
      console.error("Cleanup failed:", e);
    }
    await prisma.$disconnect();
  });
});
