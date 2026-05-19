import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("Onboarding & Intake Flow", () => {
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const patientEmail = `patient-${randomSuffix}@example.com`;
  const doctorEmail = `doctor-${randomSuffix}@example.com`;

  let patientToken: string;
  let doctorToken: string;
  let intakeId: string;

  it("Preparation: Register Patient & Doctor", async () => {
    // 1. Register Patient
    let res = await request(app).post("/api/auth/register").send({
      email: patientEmail, password: "Password123!", firstName: "John", lastName: "Patient", ndprConsent: true
    });
    expect(res.status).toBe(201);
    patientToken = res.body.data.accessToken;

    // Verify Patient Email (simulated)
    const patientUser = await prisma.user.findUnique({ where: { email: patientEmail } });
    await request(app).post(`/api/auth/verify-email/${patientUser?.emailVerificationToken}`);

    // Login to get fresh token
    res = await request(app).post("/api/auth/login").send({ email: patientEmail, password: "Password123!" });
    patientToken = res.body.data.accessToken;

    // 2. Register Doctor
    res = await request(app).post("/api/auth/register").send({
      email: doctorEmail, password: "Password123!", firstName: "Jane", lastName: "Doctor", ndprConsent: true
    });
    const doctorUser = await prisma.user.findUnique({ where: { email: doctorEmail } });
    await request(app).post(`/api/auth/verify-email/${doctorUser?.emailVerificationToken}`);

    res = await request(app).post("/api/auth/login").send({ email: doctorEmail, password: "Password123!" });
    doctorToken = res.body.data.accessToken;

    // Elevate Doctor to ADMIN role manually and enable MFA in DB to pass requireMfa gate in tests
    await prisma.user.update({ where: { email: doctorEmail }, data: { role: "ADMIN", mfaEnabled: true } });
  });

  it("Step 1: Patient creates Onboarding Profile", async () => {
    const response = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        firstName: "John",
        lastName: "Patient",
        gender: "MALE",
        dob: "1990-01-01",
        address: "123 Health Street",
        stateOfResidence: "Lagos",
        marketingOptIn: false
      });

    if (response.status !== 201) console.log("Step 1 Error:", response.body);
    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("patientId");
  });

  it("Step 2: Patient starts an Intake", async () => {
    const response = await request(app)
      .post("/api/intake/start")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ vertical: "WEIGHT_LOSS" });

    if (response.status !== 201) console.log("Step 2 Error:", response.body);
    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("intakeId");
    intakeId = response.body.data.intakeId;
  });

  it("Step 3: Save partial step (Triggers soft exclusion)", async () => {
    const response = await request(app)
      .post(`/api/intake/${intakeId}/step/1`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        personalDetails: { ageYears: 30 },
        biometrics: { bmi: 25 } // BMI < 27 should trigger soft exclusion
      });

    if (response.status !== 200) console.log("Step 3 Error:", response.body);
    expect(response.status).toBe(200);
    expect(response.body.data.flags).toContain("WL_BMI_UNDER_27");
  });

  it("Step 4: Save same step again (Idempotent update)", async () => {
    const response = await request(app)
      .post(`/api/intake/${intakeId}/step/1`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        personalDetails: { ageYears: 30 },
        biometrics: { bmi: 28 } // Corrected BMI, removes soft exclusion
      });

    if (response.status !== 200) console.log("Step 4 Error:", response.body);
    expect(response.status).toBe(200);
    expect(response.body.data.flags).not.toContain("WL_BMI_UNDER_27");
  });

  it("Step 5: Patient submits Intake", async () => {
    const response = await request(app)
      .post(`/api/intake/${intakeId}/submit`)
      .set("Authorization", `Bearer ${patientToken}`);

    if (response.status !== 200) console.log("Step 5 Submit Error:", response.body);
    expect(response.status).toBe(200);
    expect(response.body.data.eligibility).toBe("ELIGIBLE");

    // Attempting to modify locked intake should fail
    const saveResponse = await request(app)
      .post(`/api/intake/${intakeId}/step/2`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ random: "data" });

    if (saveResponse.status !== 403) console.log("Step 5 Save Error:", saveResponse.body);
    expect(saveResponse.status).toBe(403);
    expect(saveResponse.body.message).toContain("locked");
  });

  it("Step 6: Doctor unlocks the Intake", async () => {
    const response = await request(app)
      .post(`/api/intake/${intakeId}/unlock`)
      .set("Authorization", `Bearer ${doctorToken}`);

    if (response.status !== 200) console.log("Step 6 Error:", response.body);
    expect(response.status).toBe(200);
    expect(response.body.message).toContain("unlocked");
  });

  it("Step 7: Patient modifies the now-unlocked Intake", async () => {
    const response = await request(app)
      .post(`/api/intake/${intakeId}/step/2`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ newField: "added after unlock" });

    if (response.status !== 200) console.log("Step 7 Error:", response.body);
    expect(response.status).toBe(200);
  });

  afterAll(async () => {
    // Cleanup Database
    try {
      const pUser = await prisma.user.findUnique({ where: { email: patientEmail } });
      const dUser = await prisma.user.findUnique({ where: { email: doctorEmail } });

      if (pUser) {
        await prisma.intake.deleteMany({ where: { patientId: pUser.patient?.id } });
        await prisma.patient.deleteMany({ where: { userId: pUser.id } });
        await prisma.auditLog.deleteMany({ where: { userId: pUser.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: pUser.id } });
        await prisma.user.delete({ where: { id: pUser.id } });
      }

      if (dUser) {
        await prisma.patient.deleteMany({ where: { userId: dUser.id } });
        await prisma.auditLog.deleteMany({ where: { userId: dUser.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: dUser.id } });
        await prisma.user.delete({ where: { id: dUser.id } });
      }
    } catch (e) {
      console.error("Cleanup failed", e);
    }
    await prisma.$disconnect();
  });
});
