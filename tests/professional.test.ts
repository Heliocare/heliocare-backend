import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("Professional Module Integration Tests", () => {
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const adminEmail = `admin-prof-${randomSuffix}@example.com`;
  const newDoctorEmail = `newdoc-${randomSuffix}@example.com`;
  const pharmacistEmail = `pharm-prof-${randomSuffix}@example.com`;
  const dietitianEmail = `diet-prof-${randomSuffix}@example.com`;

  let adminToken: string;
  let adminUserId: string;
  let newDoctorToken: string;
  let newDoctorUserId: string;
  let newDoctorProfileId: string;
  let pharmacistToken: string;
  let pharmacistUserId: string;
  let pharmacistProfileId: string;
  let dietitianProfileId: string;
  let patientId: string;

  const userIds: string[] = [];
  const profileIds: string[] = [];

  it("Step 1: Preparation — Register admin, professionals, and patient", async () => {
    // Register admin user — login BEFORE setting mfaEnabled
    let res = await request(app).post("/api/auth/register").send({
      email: adminEmail,
      password: "Password123!",
      firstName: "Admin",
      lastName: "Professional",
      ndprConsent: true,
    });
    expect(res.status).toBe(201);

    const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    adminUserId = adminUser!.id;
    userIds.push(adminUserId);
    await request(app).post(`/api/auth/verify-email/${adminUser?.emailVerificationToken}`);

    // Login first, then upgrade role and set mfaEnabled
    res = await request(app).post("/api/auth/login").send({
      email: adminEmail,
      password: "Password123!",
    });
    adminToken = res.body.data.accessToken;

    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: "ADMIN", mfaEnabled: true },
    });

    // Register pharmacist — login BEFORE setting mfaEnabled
    res = await request(app).post("/api/auth/register").send({
      email: pharmacistEmail,
      password: "Password123!",
      firstName: "Pharm",
      lastName: "Professional",
      ndprConsent: true,
    });
    expect(res.status).toBe(201);

    const pharmUser = await prisma.user.findUnique({ where: { email: pharmacistEmail } });
    pharmacistUserId = pharmUser!.id;
    userIds.push(pharmacistUserId);
    await request(app).post(`/api/auth/verify-email/${pharmUser?.emailVerificationToken}`);

    // Login before role change + mfa
    res = await request(app).post("/api/auth/login").send({
      email: pharmacistEmail,
      password: "Password123!",
    });
    pharmacistToken = res.body.data.accessToken;

    await prisma.user.update({
      where: { id: pharmacistUserId },
      data: { role: "PHARMACIST", mfaEnabled: true },
    });

    // Create pharmacist profile
    const pharmProfile = await prisma.professionalProfile.create({
      data: {
        userId: pharmacistUserId,
        fullName: "Pharm. Test Professional",
        registrationNum: `PCN-PROF-${randomSuffix}`,
        regBody: "PCN",
        status: "VERIFIED",
        isAvailable: true,
        maxOpenConsults: 30,
      },
    });
    pharmacistProfileId = pharmProfile.id;
    profileIds.push(pharmacistProfileId);

    // Register dietitian
    res = await request(app).post("/api/auth/register").send({
      email: dietitianEmail,
      password: "Password123!",
      firstName: "Diet",
      lastName: "Professional",
      ndprConsent: true,
    });
    expect(res.status).toBe(201);

    const dietUser = await prisma.user.findUnique({ where: { email: dietitianEmail } });
    userIds.push(dietUser!.id);
    await request(app).post(`/api/auth/verify-email/${dietUser?.emailVerificationToken}`);

    await prisma.user.update({
      where: { id: dietUser!.id },
      data: { role: "DIETITIAN" },
    });

    const dietProfile = await prisma.professionalProfile.create({
      data: {
        userId: dietUser!.id,
        fullName: "Diet. Test Professional",
        registrationNum: `ODBN-PROF-${randomSuffix}`,
        regBody: "ODBN",
        status: "VERIFIED",
        isAvailable: true,
        maxOpenConsults: 20,
      },
    });
    dietitianProfileId = dietProfile.id;
    profileIds.push(dietitianProfileId);

    // Create patient via direct prisma (not via registration)
    const patientUser = await prisma.user.create({
      data: {
        email: `pat-prof-${randomSuffix}@example.com`,
        password: "ignored_hash",
        role: "PATIENT",
        isActive: true,
        isEmailVerified: true,
        patient: {
          create: {
            firstName: "Patient",
            lastName: "ProfessionalTest",
            gender: "MALE",
            dob: new Date("1990-05-15"),
            address: "1 Patient Way",
            stateOfResidence: "Lagos",
          },
        },
      },
      include: { patient: true },
    });
    userIds.push(patientUser.id);
    patientId = patientUser.patient!.id;
  }, 30000);

  it("Step 2: Admin invites a new doctor", async () => {
    const res = await request(app)
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: newDoctorEmail,
        role: "DOCTOR",
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("Invitation successfully sent");

    const newDoctorUser = await prisma.user.findUnique({
      where: { email: newDoctorEmail },
      include: { professionalProfile: true },
    });
    expect(newDoctorUser).toBeDefined();
    expect(newDoctorUser!.isActive).toBe(false);
    expect(newDoctorUser!.professionalProfile).toBeDefined();
    expect(newDoctorUser!.professionalProfile!.status).toBe("PENDING");
    expect(newDoctorUser!.professionalProfile!.fullName).toBe("TBD");

    newDoctorUserId = newDoctorUser!.id;
    newDoctorProfileId = newDoctorUser!.professionalProfile!.id;
    userIds.push(newDoctorUserId);
    profileIds.push(newDoctorProfileId);
  });

  it("Step 3: Invited doctor activates account", async () => {
    const user = await prisma.user.findUnique({ where: { email: newDoctorEmail } });

    const res = await request(app).post("/api/auth/activate").send({
      token: user!.emailVerificationToken,
      password: "DoctorPass123!",
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("activated");

    const updated = await prisma.user.findUnique({ where: { email: newDoctorEmail } });
    expect(updated!.isActive).toBe(true);
  });

  it("Step 4: Doctor logs in and completes profile", async () => {
    // Login BEFORE setting mfaEnabled
    let res = await request(app).post("/api/auth/login").send({
      email: newDoctorEmail,
      password: "DoctorPass123!",
    });
    newDoctorToken = res.body.data.accessToken;

    // Set mfaEnabled after login so requireMfa middleware passes
    await prisma.user.update({
      where: { id: newDoctorUserId },
      data: { mfaEnabled: true },
    });

    res = await request(app)
      .patch("/api/professionals/profile")
      .set("Authorization", `Bearer ${newDoctorToken}`)
      .send({
        fullName: "Dr. Newly Invited",
        registrationNum: `MDCN-PROF-${randomSuffix}`,
        specialisation: "Cardiology",
        availability: JSON.stringify([
          { day: "MONDAY", startTime: "09:00", endTime: "17:00" },
          { day: "WEDNESDAY", startTime: "09:00", endTime: "13:00" },
        ]),
      });

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe("Dr. Newly Invited");
    expect(res.body.data.specialisation).toBe("Cardiology");
  });

  it("Step 5: Admin approves the new doctor", async () => {
    const res = await request(app)
      .patch(`/api/admin/professionals/${newDoctorProfileId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("approved");

    const profile = await prisma.professionalProfile.findUnique({
      where: { id: newDoctorProfileId },
    });
    expect(profile!.status).toBe("VERIFIED");
  });

  it("Step 6: Doctor sets availability schedule", async () => {
    const res = await request(app)
      .patch("/api/professionals/availability")
      .set("Authorization", `Bearer ${newDoctorToken}`)
      .send({
        availability: [
          { day: "MONDAY", startTime: "08:00", endTime: "16:00" },
          { day: "TUESDAY", startTime: "08:00", endTime: "16:00" },
          { day: "THURSDAY", startTime: "09:00", endTime: "17:00" },
        ],
        maxOpenConsults: 25,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.maxOpenConsults).toBe(25);

    const profile = await prisma.professionalProfile.findUnique({
      where: { id: newDoctorProfileId },
    });
    const avail = JSON.parse(profile!.availability!);
    expect(avail).toHaveLength(3);
  });

  it("Step 7: Non-doctor/dietitian cannot set availability", async () => {
    const res = await request(app)
      .patch("/api/professionals/availability")
      .set("Authorization", `Bearer ${pharmacistToken}`)
      .send({
        availability: [
          { day: "MONDAY", startTime: "09:00", endTime: "17:00" },
        ],
      });

    expect(res.status).toBe(403);
  });

  it("Step 8: List professionals by role and status", async () => {
    // Filter by regBody
    let res = await request(app)
      .get("/api/professionals?regBody=MDCN&status=VERIFIED")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    for (const prof of res.body.data) {
      expect(prof.regBody).toBe("MDCN");
      expect(prof.status).toBe("VERIFIED");
    }

    // Filter by role
    res = await request(app)
      .get("/api/professionals?role=PHARMACIST")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("Step 9: Create patient-professional assignments", async () => {
    await prisma.patientProfessional.create({
      data: {
        patientId,
        professionalId: newDoctorProfileId,
      },
    });

    const assignments = await prisma.patientProfessional.findMany({
      where: { professionalId: newDoctorProfileId },
    });
    expect(assignments.length).toBe(1);
  });

  it("Step 10: Admin suspends the doctor", async () => {
    const res = await request(app)
      .patch(`/api/professionals/${newDoctorProfileId}/suspend`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reason: "Repeated policy violations and patient complaints received",
      });

    expect(res.status).toBe(200);

    const profile = await prisma.professionalProfile.findUnique({
      where: { id: newDoctorProfileId },
    });
    expect(profile!.status).toBe("SUSPENDED");
    expect(profile!.isAvailable).toBe(false);

    const user = await prisma.user.findUnique({ where: { id: newDoctorUserId } });
    expect(user!.isActive).toBe(false);
  });

  it("Step 11: Suspended doctor cannot log in", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: newDoctorEmail,
      password: "DoctorPass123!",
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("suspended");
  });

  it("Step 12: Admin reassigns patients to dietitian", async () => {
    const res = await request(app)
      .post("/api/professionals/reassign")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fromProfessionalId: newDoctorProfileId,
        toProfessionalId: dietitianProfileId,
        reason: "Reassigning patients due to doctor suspension for policy violations",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.reassignedCount).toBe(1);

    // Old assignments should be deleted
    const oldAssignments = await prisma.patientProfessional.findMany({
      where: { professionalId: newDoctorProfileId },
    });
    expect(oldAssignments.length).toBe(0);

    // New assignments should exist
    const newAssignments = await prisma.patientProfessional.findMany({
      where: { professionalId: dietitianProfileId },
    });
    expect(newAssignments.length).toBe(1);
    expect(newAssignments[0]!.patientId).toBe(patientId);
  });

  it("Step 13: Reassignment audit log exists", async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: "PATIENTS_REASSIGNED",
        entityId: newDoctorProfileId,
      },
    });

    expect(logs.length).toBe(1);
    const metadata = JSON.parse(logs[0]!.metadata || "{}");
    expect(metadata.fromId).toBe(newDoctorProfileId);
    expect(metadata.toId).toBe(dietitianProfileId);
    expect(metadata.patientCount).toBe(1);
    expect(metadata.reason).toContain("Reassigning patients");
    expect(logs[0]!.userId).toBe(adminUserId);
  });

  it("Step 14: Admin deactivates the pharmacist", async () => {
    const res = await request(app)
      .patch(`/api/professionals/${pharmacistProfileId}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reason: "VOLUNTARY_RESIGNATION",
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("deactivated");

    // Verify isActive set to false, profile status unchanged
    const user = await prisma.user.findUnique({ where: { id: pharmacistUserId } });
    expect(user!.isActive).toBe(false);

    const profile = await prisma.professionalProfile.findUnique({
      where: { id: pharmacistProfileId },
    });
    expect(profile!.status).toBe("VERIFIED");

    // Verify deactivation audit log
    const logs = await prisma.auditLog.findMany({
      where: {
        action: "PROFESSIONAL_DEACTIVATED",
        entityId: pharmacistProfileId,
      },
    });
    expect(logs.length).toBe(1);
  });

  it("Step 15: Deactivated professional cannot log in", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: pharmacistEmail,
      password: "Password123!",
    });

    expect(res.status).toBe(403);
  });

  afterAll(async () => {
    // Cleanup in dependency-safe order
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.order.deleteMany({ where: { patientId } });
    await prisma.prescription.deleteMany({ where: { patientId } });
    await prisma.subscription.deleteMany({ where: { patientId } });
    await prisma.labResult.deleteMany({
      where: { request: { patientId } },
    });
    await prisma.labTestRequest.deleteMany({ where: { patientId } });
    await prisma.patientProfessional.deleteMany({
      where: {
        OR: [
          { patientId },
          { professionalId: { in: profileIds } },
        ],
      },
    });
    await prisma.professionalProfile.deleteMany({
      where: { id: { in: profileIds } },
    });
    // Delete all patients linked to the test users (registerPatient creates a Patient per user)
    await prisma.patient.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });
});
