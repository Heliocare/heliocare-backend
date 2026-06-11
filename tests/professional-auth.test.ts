import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { generate } from "otplib";

describe("Professional Invitation & MFA Security Flow", () => {
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const adminEmail = `admin-${randomSuffix}@example.com`;
  const doctorEmail = `doc-${randomSuffix}@example.com`;
  
  let adminToken: string;
  let doctorToken: string;
  let invitationToken: string;
  let doctorProfileId: string;

  it("Preparation: Register & Setup Admin with MFA", async () => {
    // 1. Register Admin
    let res = await request(app).post("/api/auth/register").send({
      email: adminEmail, password: "Password123!", firstName: "System", lastName: "Admin", ndprConsent: true
    });
    expect(res.status).toBe(201);

    // Verify Admin Email (simulated)
    const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    await request(app).post(`/api/auth/verify-email/${adminUser?.emailVerificationToken}`);

    // Elevate to ADMIN role manually for testing the admin endpoints
    await prisma.user.update({ where: { email: adminEmail }, data: { role: "ADMIN" } });

    // Initial Admin Login (before MFA is required, since MFA isn't enabled yet)
    res = await request(app).post("/api/auth/login").send({ email: adminEmail, password: "Password123!" });
    adminToken = res.body.data.accessToken;

    // 2. Setup MFA for Admin (since admin endpoints are secured with requireMfa)
    const mfaSetup = await request(app)
      .post("/api/auth/mfa/setup")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(mfaSetup.status).toBe(200);
    const adminMfaSecret = mfaSetup.body.data.secret;

    // Generate TOTP token and enable MFA
    const adminOtp = await generate({ secret: adminMfaSecret });
    const mfaEnable = await request(app)
      .post("/api/auth/mfa/enable")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ token: adminOtp });
    expect(mfaEnable.status).toBe(200);

    // Log in again with MFA token to get a fresh token with MFA enabled state
    const freshAdminOtp = await generate({ secret: adminMfaSecret });
    res = await request(app)
      .post("/api/auth/login")
      .send({ email: adminEmail, password: "Password123!", token: freshAdminOtp });
    adminToken = res.body.data.accessToken;
  });

  it("Step 1: Admin invites a new Doctor", async () => {
    const response = await request(app)
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: doctorEmail,
        role: "DOCTOR"
      });
    
    expect(response.status).toBe(200);
    expect(response.body.message).toContain("Invitation successfully sent");

    // Retrieve invitation token from database
    const doctorUser = await prisma.user.findUnique({
      where: { email: doctorEmail },
      include: { professionalProfile: true }
    });
    expect(doctorUser).toBeDefined();
    expect(doctorUser?.isActive).toBe(false);
    expect(doctorUser?.professionalProfile?.status).toBe("PENDING");

    invitationToken = doctorUser?.emailVerificationToken as string;
    doctorProfileId = doctorUser?.professionalProfile?.id as string;
    expect(invitationToken).toBeDefined();
    expect(doctorProfileId).toBeDefined();
  });

  it("Step 2: Doctor activates account using token", async () => {
    const response = await request(app)
      .post("/api/auth/activate")
      .send({
        token: invitationToken,
        password: "StrongDoctorPassword123!"
      });
    
    expect(response.status).toBe(200);
    expect(response.body.message).toContain("Account activated successfully");

    const doctorUser = await prisma.user.findUnique({ where: { email: doctorEmail } });
    expect(doctorUser?.isActive).toBe(true);
    expect(doctorUser?.isEmailVerified).toBe(true);
  });

  it("Step 3: Initial Login & MFA Gate Block", async () => {
    // 1. Initial Login returns tokens
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: doctorEmail, password: "StrongDoctorPassword123!" });
    
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data).toHaveProperty("accessToken");
    doctorToken = loginRes.body.data.accessToken;

    // 2. Accessing clinical resources (e.g., unlocking an intake) should fail due to missing MFA
    const testIntakeId = "00000000-0000-0000-0000-000000000000";
    const clinicalRes = await request(app)
      .post(`/api/intake/${testIntakeId}/unlock`)
      .set("Authorization", `Bearer ${doctorToken}`);
    
    expect(clinicalRes.status).toBe(403);
    expect(clinicalRes.body.message).toContain("Multi-factor authentication is mandatory");
  });

  it("Step 4: Admin approves Doctor's credentials", async () => {
    const response = await request(app)
      .patch(`/api/admin/professionals/${doctorProfileId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.message).toContain("approved and activated");

    const doctorProfile = await prisma.professionalProfile.findUnique({ where: { id: doctorProfileId } });
    expect(doctorProfile?.status).toBe("VERIFIED");
  });

  it("Step 5: Doctor sets up & enables MFA", async () => {
    // 1. Setup MFA
    const setupRes = await request(app)
      .post("/api/auth/mfa/setup")
      .set("Authorization", `Bearer ${doctorToken}`);
    
    expect(setupRes.status).toBe(200);
    expect(setupRes.body.data).toHaveProperty("secret");
    const mfaSecret = setupRes.body.data.secret;

    // 2. Enable MFA using code
    const otpCode = await generate({ secret: mfaSecret });
    const enableRes = await request(app)
      .post("/api/auth/mfa/enable")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({ token: otpCode });
    
    expect(enableRes.status).toBe(200);

    const doctorUser = await prisma.user.findUnique({ where: { email: doctorEmail } });
    expect(doctorUser?.mfaEnabled).toBe(true);
  });

  it("Step 6: Doctor successfully bypasses MFA gate", async () => {
    const testIntakeId = "00000000-0000-0000-0000-000000000000";
    const response = await request(app)
      .post(`/api/intake/${testIntakeId}/unlock`)
      .set("Authorization", `Bearer ${doctorToken}`);
    
    // Should NOT be 403 Forbidden because MFA is enabled now.
    // Since the UUID is fake/non-existent, we expect 404 Not Found instead of 403.
    expect(response.status).toBe(404);
  });

  afterAll(async () => {
    // Cleanup Database
    try {
      const aUser = await prisma.user.findUnique({ where: { email: adminEmail } });
      const dUser = await prisma.user.findUnique({ where: { email: doctorEmail } });
      
      if (aUser) {
        await prisma.patient.deleteMany({ where: { userId: aUser.id } });
        await prisma.professionalProfile.deleteMany({ where: { userId: aUser.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: aUser.id } });
        await prisma.auditLog.deleteMany({ where: { userId: aUser.id } });
        await prisma.user.delete({ where: { id: aUser.id } });
      }
      
      if (dUser) {
        await prisma.patient.deleteMany({ where: { userId: dUser.id } });
        await prisma.professionalProfile.deleteMany({ where: { userId: dUser.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: dUser.id } });
        await prisma.auditLog.deleteMany({ where: { userId: dUser.id } });
        await prisma.user.delete({ where: { id: dUser.id } });
      }
    } catch (e) {
      console.error("Cleanup failed", e);
    }
    await prisma.$disconnect();
  });
});
