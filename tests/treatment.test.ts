import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("Treatment Plan Module Integration Tests", () => {
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const patientEmail = `tp-pat-${randomSuffix}@example.com`;
  const doctorEmail = `tp-doc-${randomSuffix}@example.com`;
  const dietitianEmail = `tp-diet-${randomSuffix}@example.com`;
  const otherDoctorEmail = `tp-otherdoc-${randomSuffix}@example.com`;

  let patientToken: string;
  let patientId: string;
  let patientUserId: string;

  let doctorToken: string;
  let doctorUserId: string;
  let doctorProfileId: string;

  let dietitianToken: string;
  let dietitianUserId: string;
  let dietitianProfileId: string;

  let otherDoctorToken: string;
  let otherDoctorUserId: string;
  let otherDoctorProfileId: string;

  let planId: string; // the v1 plan ID
  let v2PlanId: string;
  let labResultId: string;

  // ── Preparation ──────────────────────────────────────────────

  it("Prep: Register Patient, verify email, complete onboarding", async () => {
    let res = await request(app).post("/api/auth/register").send({
      email: patientEmail,
      password: "Password123!",
      firstName: "Plan",
      lastName: "Patient",
      ndprConsent: true,
    });
    expect(res.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: patientEmail } });
    patientUserId = user!.id;
    await request(app).post(`/api/auth/verify-email/${user?.emailVerificationToken}`);

    res = await request(app).post("/api/auth/login").send({
      email: patientEmail, password: "Password123!",
    });
    patientToken = res.body.data.accessToken;

    res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        firstName: "Plan", lastName: "Patient",
        gender: "MALE", dob: "1985-08-20",
        address: "10 Plan Street", stateOfResidence: "Lagos",
        marketingOptIn: false,
      });
    expect(res.status).toBe(201);
    patientId = res.body.data.patientId;
  });

  it("Prep: Create Doctor with profile & assign to patient", async () => {
    let res = await request(app).post("/api/auth/register").send({
      email: doctorEmail, password: "Password123!",
      firstName: "Doc", lastName: "PlanCreator", ndprConsent: true,
    });
    expect(res.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: doctorEmail } });
    doctorUserId = user!.id;
    await request(app).post(`/api/auth/verify-email/${user?.emailVerificationToken}`);

    res = await request(app).post("/api/auth/login").send({
      email: doctorEmail, password: "Password123!",
    });
    doctorToken = res.body.data.accessToken;

    await prisma.user.update({
      where: { id: doctorUserId },
      data: { role: "DOCTOR", mfaEnabled: true },
    });
    await prisma.patient.deleteMany({ where: { userId: doctorUserId } });

    const profile = await prisma.professionalProfile.create({
      data: {
        userId: doctorUserId, fullName: "Dr. Plan Creator",
        registrationNum: `MDCN-TP-${randomSuffix}`,
        regBody: "MDCN", status: "VERIFIED", isAvailable: true, maxOpenConsults: 25,
      },
    });
    doctorProfileId = profile.id;

    await prisma.patientProfessional.create({
      data: { patientId, professionalId: doctorProfileId },
    });
  });

  it("Prep: Create Dietitian with profile & assign to patient", async () => {
    let res = await request(app).post("/api/auth/register").send({
      email: dietitianEmail, password: "Password123!",
      firstName: "Diet", lastName: "Professional", ndprConsent: true,
    });
    expect(res.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: dietitianEmail } });
    dietitianUserId = user!.id;
    await request(app).post(`/api/auth/verify-email/${user?.emailVerificationToken}`);

    res = await request(app).post("/api/auth/login").send({
      email: dietitianEmail, password: "Password123!",
    });
    dietitianToken = res.body.data.accessToken;

    await prisma.user.update({
      where: { id: dietitianUserId },
      data: { role: "DIETITIAN", mfaEnabled: true },
    });
    await prisma.patient.deleteMany({ where: { userId: dietitianUserId } });

    const profile = await prisma.professionalProfile.create({
      data: {
        userId: dietitianUserId, fullName: "Dietitian Professional",
        registrationNum: `ODBN-TP-${randomSuffix}`,
        regBody: "ODBN", status: "VERIFIED", isAvailable: true, maxOpenConsults: 25,
      },
    });
    dietitianProfileId = profile.id;

    await prisma.patientProfessional.create({
      data: { patientId, professionalId: dietitianProfileId },
    });
  });

  it("Prep: Create unassigned Doctor (no patient assignment)", async () => {
    let res = await request(app).post("/api/auth/register").send({
      email: otherDoctorEmail, password: "Password123!",
      firstName: "Other", lastName: "Doctor", ndprConsent: true,
    });
    expect(res.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: otherDoctorEmail } });
    otherDoctorUserId = user!.id;
    await request(app).post(`/api/auth/verify-email/${user?.emailVerificationToken}`);

    res = await request(app).post("/api/auth/login").send({
      email: otherDoctorEmail, password: "Password123!",
    });
    otherDoctorToken = res.body.data.accessToken;

    await prisma.user.update({
      where: { id: otherDoctorUserId },
      data: { role: "DOCTOR", mfaEnabled: true },
    });
    await prisma.patient.deleteMany({ where: { userId: otherDoctorUserId } });

    const profile = await prisma.professionalProfile.create({
      data: {
        userId: otherDoctorUserId, fullName: "Dr. Unassigned",
        registrationNum: `MDCN-OTHER-${randomSuffix}`,
        regBody: "MDCN", status: "VERIFIED", isAvailable: true, maxOpenConsults: 25,
      },
    });
    otherDoctorProfileId = profile.id;
    // NOT assigned to patient
  });

  it("Prep: Create a LabResult for annotation tests", async () => {
    // Create a LabTestRequest + LabResult
    const request = await prisma.labTestRequest.create({
      data: {
        patientId, professionalId: doctorProfileId,
        testCodes: JSON.stringify(["CBC", "LFT"]),
        status: "COMPLETED",
        sampleMethod: "WALK_IN",
      },
    });

    const result = await prisma.labResult.create({
      data: {
        requestId: request.id,
        testName: "Hemoglobin",
        value: "14.5",
        unit: "g/dL",
        referenceRange: "13.5-17.5",
        flag: "NORMAL",
      },
    });
    labResultId = result.id;
  });

  // ── Step 1: Create Treatment Plan ────────────────────────────

  it("Step 1: Doctor creates treatment plan (v1)", async () => {
    const res = await request(app)
      .post("/api/treatment")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        patientId,
        title: "Initial Weight Loss Plan",
        description: "Caloric restriction with exercise regimen",
        startDate: new Date().toISOString(),
      });

    if (res.status !== 201) console.log("Step 1 Error:", res.body);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.parentId).toBeNull();
    expect(res.body.data.status).toBe("ACTIVE");
    expect(res.body.data.dietitianReferralStatus).toBe("NOT_REFERRED");

    planId = res.body.data.id;
  });

  it("Step 1b: Patient can view own plan", async () => {
    const res = await request(app)
      .get(`/api/treatment/${planId}`)
      .set("Authorization", `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Initial Weight Loss Plan");
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.isLatest).toBe(true);
    expect(res.body.data.totalVersions).toBe(1);
  });

  it("Step 1c: Unassigned doctor gets 403 on patient's plan list", async () => {
    const res = await request(app)
      .get(`/api/treatment/patient/${patientId}`)
      .set("Authorization", `Bearer ${otherDoctorToken}`);

    expect(res.status).toBe(403);
  });

  it("Step 1d: Patient cannot create a treatment plan", async () => {
    const res = await request(app)
      .post("/api/treatment")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        patientId,
        title: "Hacked Plan",
      });

    expect(res.status).toBe(403);
  });

  // ── Step 2: Update creates new version ───────────────────────

  it("Step 2: Doctor updates plan — creates v2, archives v1", async () => {
    const res = await request(app)
      .put(`/api/treatment/${planId}`)
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        title: "Updated Weight Loss Plan",
        description: "Enhanced caloric restriction with GLP-1 support",
      });

    if (res.status !== 200) console.log("Step 2 Error:", res.body);
    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.parentId).toBe(planId); // v2 parent is v1
    expect(res.body.data.title).toBe("Updated Weight Loss Plan");
    expect(res.body.data.status).toBe("ACTIVE");

    v2PlanId = res.body.data.id;

    // v1 should now be COMPLETED (archived)
    const v1 = await prisma.treatmentPlan.findUnique({ where: { id: planId } });
    expect(v1!.status).toBe("COMPLETED");
    expect(v1!.version).toBe(1);
  });

  it("Step 2b: GET /:id on v1 returns latest version (v2)", async () => {
    const res = await request(app)
      .get(`/api/treatment/${planId}`)
      .set("Authorization", `Bearer ${doctorToken}`);

    // Should return v2 since it's the latest in the lineage
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.title).toBe("Updated Weight Loss Plan");
    expect(res.body.data.isLatest).toBe(true);
    expect(res.body.data.totalVersions).toBe(2);
  });

  it("Step 2c: Version history returns all versions", async () => {
    const res = await request(app)
      .get(`/api/treatment/${v2PlanId}/history`)
      .set("Authorization", `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    // Versions should include v1 and v2
    const versions = res.body.data.map((v: { version: number }) => v.version);
    expect(versions).toContain(1);
    expect(versions).toContain(2);
  });

  it("Step 2d: Update with no fields returns 400", async () => {
    const res = await request(app)
      .put(`/api/treatment/${v2PlanId}`)
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  // ── Step 3: Dietitian views plan via /patient/:patientId ─────

  it("Step 3: Assigned dietitian can list patient's plans", async () => {
    const res = await request(app)
      .get(`/api/treatment/patient/${patientId}`)
      .set("Authorization", `Bearer ${dietitianToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    // Should show latest version for each root plan
    const plan = res.body.data[0];
    expect(plan.version).toBe(2);
    expect(plan.title).toBe("Updated Weight Loss Plan");
  });

  // ── Step 4: Dietitian Referral ───────────────────────────────

  it("Step 4: Doctor sets dietitian referral status", async () => {
    const res = await request(app)
      .patch(`/api/treatment/${v2PlanId}/refer-dietitian`)
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        dietitianReferralStatus: "REFERRED",
        dietitianReferralNote: "Patient needs nutritional counseling for GLP-1 protocol",
      });

    if (res.status !== 200) console.log("Step 4 Error:", res.body);
    expect(res.status).toBe(200);
    expect(res.body.data.dietitianReferralStatus).toBe("REFERRED");

    // Verify persisted on current (v2) version
    const plan = await prisma.treatmentPlan.findUnique({ where: { id: v2PlanId } });
    expect(plan!.dietitianReferralStatus).toBe("REFERRED");
    expect(plan!.dietitianReferralNote).toContain("nutritional counseling");
  });

  it("Step 4b: Dietitian can see referral status on plan", async () => {
    const res = await request(app)
      .get(`/api/treatment/${v2PlanId}`)
      .set("Authorization", `Bearer ${dietitianToken}`);

    expect(res.body.data.dietitianReferralStatus).toBe("REFERRED");
  });

  // ── Step 5: Lab Result Annotation ────────────────────────────

  it("Step 5: Doctor annotates a lab result", async () => {
    const res = await request(app)
      .patch(`/api/treatment/lab-results/${labResultId}/annotate`)
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        annotation: "Normal result — patient cleared for GLP-1 therapy. -Dr. Smith",
      });

    if (res.status !== 200) console.log("Step 5 Error:", res.body);
    expect(res.status).toBe(200);
    expect(res.body.data.doctorAnnotation).toContain("GLP-1 therapy");

    // Verify persisted in DB
    const labResult = await prisma.labResult.findUnique({
      where: { id: labResultId },
      select: { doctorAnnotation: true, annotatedById: true, annotatedAt: true },
    });
    expect(labResult!.doctorAnnotation).toContain("GLP-1 therapy");
    expect(labResult!.annotatedById).toBe(doctorProfileId);
    expect(labResult!.annotatedAt).toBeTruthy();
  });

  it("Step 5b: Lab annotation visible in DB audit log", async () => {
    const auditLog = await prisma.auditLog.findFirst({
      where: { action: "LAB_RESULT_ANNOTATED", entityId: labResultId },
    });
    expect(auditLog).not.toBeNull();
    const metadata = JSON.parse(auditLog!.metadata!);
    expect(metadata.testName).toBe("Hemoglobin");
  });

  it("Step 5c: Dietitian cannot annotate lab results", async () => {
    const res = await request(app)
      .patch(`/api/treatment/lab-results/${labResultId}/annotate`)
      .set("Authorization", `Bearer ${dietitianToken}`)
      .send({ annotation: "Dietitian attempted annotation" });

    expect(res.status).toBe(403);
  });

  // ── Step 6: Plan list shows version stats ────────────────────

  it("Step 6: Plan list returns correct version metadata", async () => {
    const res = await request(app)
      .get(`/api/treatment/patient/${patientId}`)
      .set("Authorization", `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const plan = res.body.data[0];
    expect(plan).toHaveProperty("version");
    expect(plan).toHaveProperty("isLatest");
    expect(plan).toHaveProperty("totalVersions");
    expect(plan).toHaveProperty("professional");
    expect(plan.professional).toHaveProperty("fullName");
  });

  // ── Cleanup ──────────────────────────────────────────────────

  afterAll(async () => {
    try {
      const pUser = await prisma.user.findUnique({ where: { email: patientEmail } });
      const dUser = await prisma.user.findUnique({ where: { email: doctorEmail } });
      const dietUser = await prisma.user.findUnique({ where: { email: dietitianEmail } });
      const oUser = await prisma.user.findUnique({ where: { email: otherDoctorEmail } });

      // Clean Patient
      if (pUser) {
        await prisma.treatmentPlan.deleteMany({ where: { patientId: pUser.patient?.id } });
        await prisma.labResult.deleteMany({
          where: { request: { patientId: pUser.patient?.id } },
        });
        await prisma.labTestRequest.deleteMany({ where: { patientId: pUser.patient?.id } });
        await prisma.patientProfessional.deleteMany({ where: { patientId: pUser.patient?.id } });
        await prisma.auditLog.deleteMany({ where: { userId: pUser.id } });
        await prisma.patient.deleteMany({ where: { userId: pUser.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: pUser.id } });
        await prisma.user.delete({ where: { id: pUser.id } });
      }

      // Clean Doctor
      if (dUser) {
        await prisma.patientProfessional.deleteMany({ where: { professionalId: doctorProfileId } });
        await prisma.auditLog.deleteMany({ where: { userId: dUser.id } });
        await prisma.professionalProfile.deleteMany({ where: { userId: dUser.id } });
        await prisma.patient.deleteMany({ where: { userId: dUser.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: dUser.id } });
        await prisma.user.delete({ where: { id: dUser.id } });
      }

      // Clean Dietitian
      if (dietUser) {
        await prisma.patientProfessional.deleteMany({ where: { professionalId: dietitianProfileId } });
        await prisma.auditLog.deleteMany({ where: { userId: dietUser.id } });
        await prisma.professionalProfile.deleteMany({ where: { userId: dietUser.id } });
        await prisma.patient.deleteMany({ where: { userId: dietUser.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: dietUser.id } });
        await prisma.user.delete({ where: { id: dietUser.id } });
      }

      // Clean Other Doctor
      if (oUser) {
        await prisma.auditLog.deleteMany({ where: { userId: oUser.id } });
        await prisma.professionalProfile.deleteMany({ where: { userId: oUser.id } });
        await prisma.patient.deleteMany({ where: { userId: oUser.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: oUser.id } });
        await prisma.user.delete({ where: { id: oUser.id } });
      }
    } catch (e) {
      console.error("Cleanup failed:", e);
    }
    await prisma.$disconnect();
  });
});
