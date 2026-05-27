import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("Order Module Integration Tests", () => {
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const patientEmail = `pat-ord-${randomSuffix}@example.com`;
  const doctorEmail = `doc-ord-${randomSuffix}@example.com`;
  const pharmacyEmail = `pharm-ord-${randomSuffix}@example.com`;

  let patientToken: string;
  let doctorToken: string;
  let pharmacyToken: string;

  let patientId: string;
  let userId: string;
  let doctorUserId: string;
  let pharmacyUserId: string;
  let subscriptionId: string;
  let pharmacyEntityId: string;

  let autoOrderId: string;
  let glp1OrderId: string;
  let manualOrderId: string;

  const userIds: string[] = [];

  it("Preparation: Register & Setup Entities", async () => {
    // 1. Register Patient
    let res = await request(app).post("/api/auth/register").send({
      email: patientEmail,
      password: "Password123!",
      firstName: "OrderTest",
      lastName: "Patient",
      ndprConsent: true,
    });
    expect(res.status).toBe(201);
    patientToken = res.body.data.accessToken;

    const patientUser = await prisma.user.findUnique({ where: { email: patientEmail } });
    userId = patientUser!.id;
    userIds.push(userId);
    await request(app).post(`/api/auth/verify-email/${patientUser?.emailVerificationToken}`);

    res = await request(app).post("/api/auth/login").send({ email: patientEmail, password: "Password123!" });
    patientToken = res.body.data.accessToken;

    // Create Patient Profile
    res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        firstName: "OrderTest",
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
      firstName: "DrOrder",
      lastName: "Tester",
      ndprConsent: true,
    });
    expect(res.status).toBe(201);

    const doctorUser = await prisma.user.findUnique({ where: { email: doctorEmail } });
    doctorUserId = doctorUser!.id;
    userIds.push(doctorUserId);
    await request(app).post(`/api/auth/verify-email/${doctorUser?.emailVerificationToken}`);

    res = await request(app).post("/api/auth/login").send({ email: doctorEmail, password: "Password123!" });
    doctorToken = res.body.data.accessToken;

    await prisma.user.update({
      where: { id: doctorUserId },
      data: { role: "DOCTOR", mfaEnabled: true },
    });

    await prisma.professionalProfile.create({
      data: {
        userId: doctorUserId,
        fullName: "Dr. Order Tester",
        registrationNum: `MDCN-ORD-${randomSuffix}`,
        regBody: "MDCN",
        status: "VERIFIED",
      },
    });

    // 3. Register Pharmacy User
    res = await request(app).post("/api/auth/register").send({
      email: pharmacyEmail,
      password: "Password123!",
      firstName: "PharmOrder",
      lastName: "Tester",
      ndprConsent: true,
    });
    expect(res.status).toBe(201);

    const pharmacyUser = await prisma.user.findUnique({ where: { email: pharmacyEmail } });
    pharmacyUserId = pharmacyUser!.id;
    userIds.push(pharmacyUserId);
    await request(app).post(`/api/auth/verify-email/${pharmacyUser?.emailVerificationToken}`);

    res = await request(app).post("/api/auth/login").send({ email: pharmacyEmail, password: "Password123!" });
    pharmacyToken = res.body.data.accessToken;

    await prisma.user.update({
      where: { id: pharmacyUserId },
      data: { role: "PHARMACY", mfaEnabled: true },
    });

    await prisma.professionalProfile.create({
      data: {
        userId: pharmacyUserId,
        fullName: "Pharm. Order Tester",
        registrationNum: `PCN-ORD-${randomSuffix}`,
        regBody: "PCN",
        status: "VERIFIED",
      },
    });

    // Create active Pharmacy in Lagos (matches patient state)
    const pharmacy = await prisma.pharmacy.create({
      data: {
        name: "Heliocare Test Dispensary",
        pcnLicence: `PCN-LIC-ORD-${randomSuffix}`,
        address: "789 Pharmacist Blvd",
        canCompound: true,
        cities: JSON.stringify(["Lagos"]),
        isActive: true,
      },
    });
    pharmacyEntityId = pharmacy.id;

    // Seed LabResult to pass GLP-1 gate
    const labRequest = await prisma.labTestRequest.create({
      data: {
        patientId,
        professionalId: (
          await prisma.professionalProfile.findUnique({ where: { userId: doctorUserId } })
        )!.id,
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
  }, 30000);

  it("Step 1: Non-GLP-1 prescription auto-creates PENDING order", async () => {
    const res = await request(app)
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

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");

    // Query orders to find the auto-created one
    const orderRes = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${doctorToken}`);

    expect(orderRes.status).toBe(200);
    expect(orderRes.body.data.length).toBeGreaterThanOrEqual(1);

    const order = orderRes.body.data.find((o: any) => o.prescriptionId === res.body.data.id);
    expect(order).toBeDefined();
    expect(order.status).toBe("PENDING");
    expect(order.coldChain).toBe(false);
    expect(order.discreetPackaging).toBe(true);
    expect(order.pharmacyId).toBeDefined();

    autoOrderId = order.id;
  }, 15000);

  it("Step 2: GLP-1 prescription order has coldChain = true", async () => {
    const res = await request(app)
      .post("/api/prescriptions")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        patientId,
        subscriptionId,
        drugName: "Semaglutide (Ozempic)",
        doseMg: 0.25,
        frequency: "Once weekly",
        quantity: 4,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(201);

    const orderRes = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${doctorToken}`);

    const glp1Order = orderRes.body.data.find(
      (o: any) => o.prescriptionId === res.body.data.id
    );
    expect(glp1Order).toBeDefined();
    expect(glp1Order.coldChain).toBe(true);
    expect(glp1Order.discreetPackaging).toBe(true);

    glp1OrderId = glp1Order.id;
  }, 15000);

  it("Step 3: Manual order creation via POST /api/orders", async () => {
    // First issue a prescription
    const rxRes = await request(app)
      .post("/api/prescriptions")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        patientId,
        subscriptionId,
        drugName: "Lisinopril",
        doseMg: 10,
        frequency: "Once daily",
        quantity: 30,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

    expect(rxRes.status).toBe(201);
    const prescriptionId = rxRes.body.data.id;

    // Manual order creation
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        patientId,
        prescriptionId,
        subscriptionId,
        drugName: "Lisinopril",
        patientStateOfResidence: "Lagos",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.pharmacyId).toBeDefined();

    manualOrderId = res.body.data.id;
  }, 30000);

  it("Step 4: PENDING -> ACKNOWLEDGED", async () => {
    const res = await request(app)
      .patch(`/api/orders/${autoOrderId}/status`)
      .set("Authorization", `Bearer ${pharmacyToken}`)
      .send({ status: "ACKNOWLEDGED" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ACKNOWLEDGED");
    expect(res.body.data.acknowledgedAt).toBeDefined();
  });

  it("Step 5: ACKNOWLEDGED -> PACKED", async () => {
    const res = await request(app)
      .patch(`/api/orders/${autoOrderId}/status`)
      .set("Authorization", `Bearer ${pharmacyToken}`)
      .send({ status: "PACKED" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PACKED");
    expect(res.body.data.packedAt).toBeDefined();
  });

  it("Step 6: PACKED -> DISPATCHED (with tracking info)", async () => {
    const res = await request(app)
      .patch(`/api/orders/${autoOrderId}/status`)
      .set("Authorization", `Bearer ${pharmacyToken}`)
      .send({
        status: "DISPATCHED",
        trackingNumber: `TRK-ORD-${randomSuffix}`,
        logisticsPartner: "GIG",
        estDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("DISPATCHED");
    expect(res.body.data.dispatchedAt).toBeDefined();
    expect(res.body.data.trackingNumber).toBe(`TRK-ORD-${randomSuffix}`);
    expect(res.body.data.logisticsPartner).toBe("GIG");
  });

  it("Step 7: DISPATCHED -> DELIVERED", async () => {
    const res = await request(app)
      .patch(`/api/orders/${autoOrderId}/status`)
      .set("Authorization", `Bearer ${pharmacyToken}`)
      .send({ status: "DELIVERED" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("DELIVERED");
    expect(res.body.data.deliveredAt).toBeDefined();
  });

  it("Step 8: Invalid transition is rejected", async () => {
    // glp1Order is still PENDING — try to jump to DELIVERED
    const res = await request(app)
      .patch(`/api/orders/${glp1OrderId}/status`)
      .set("Authorization", `Bearer ${pharmacyToken}`)
      .send({ status: "DELIVERED" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid status transition");
  });

  it("Step 9: PENDING -> FAILED", async () => {
    const res = await request(app)
      .patch(`/api/orders/${manualOrderId}/status`)
      .set("Authorization", `Bearer ${pharmacyToken}`)
      .send({
        status: "FAILED",
        pharmacyNotes: "Medication out of stock at all nearby pharmacies.",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("FAILED");
    expect(res.body.data.pharmacyNotes).toBe("Medication out of stock at all nearby pharmacies.");
  });

  it("Step 10: Patient can only see their own orders", async () => {
    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    // All orders should belong to this patient
    for (const order of res.body.data) {
      expect(order.patientId).toBe(patientId);
    }
  });

  it("Step 11: Patient cannot transition order status (403)", async () => {
    const res = await request(app)
      .patch(`/api/orders/${glp1OrderId}/status`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ status: "ACKNOWLEDGED" });

    expect(res.status).toBe(403);
  });

  it("Step 12: DISPATCHED requires trackingNumber and logisticsPartner", async () => {
    // Use glp1Order: ACKNOWLEDGE it first, then try DISPATCH without tracking
    await request(app)
      .patch(`/api/orders/${glp1OrderId}/status`)
      .set("Authorization", `Bearer ${pharmacyToken}`)
      .send({ status: "ACKNOWLEDGED" });

    await request(app)
      .patch(`/api/orders/${glp1OrderId}/status`)
      .set("Authorization", `Bearer ${pharmacyToken}`)
      .send({ status: "PACKED" });

    const res = await request(app)
      .patch(`/api/orders/${glp1OrderId}/status`)
      .set("Authorization", `Bearer ${pharmacyToken}`)
      .send({ status: "DISPATCHED" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
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
    await prisma.patientProfessional.deleteMany({ where: { patientId } });
    if (pharmacyEntityId) {
      await prisma.order.deleteMany({ where: { pharmacyId: pharmacyEntityId } });
    }
    await prisma.professionalProfile.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.patient.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (pharmacyEntityId) {
      await prisma.pharmacy.deleteMany({ where: { id: pharmacyEntityId } });
    }
    await prisma.$disconnect();
  });
});
