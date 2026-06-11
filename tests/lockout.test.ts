import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("Security & Lockout Flow", () => {
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const testUser = {
    email: `lockout-${randomSuffix}@example.com`,
    password: "CorrectPassword123!",
    firstName: "Lockout",
    lastName: "Test",
    ndprConsent: true,
  };

  let unlockToken: string;

  it("Preparation: Register and verify user", async () => {
    await request(app).post("/api/auth/register").send(testUser);
    const user = await prisma.user.findUnique({ where: { email: testUser.email } });
    await request(app).post(`/api/auth/verify-email/${user?.emailVerificationToken}`);
  });

  it("Step 1: should lock account after 10 failed attempts", async () => {
    for (let i = 1; i <= 10; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: "WrongPassword!" });
      
      const userInDb = await prisma.user.findUnique({ where: { email: testUser.email } });
      // console.log(`Attempt ${i}: Status ${res.status}, DB Counter: ${userInDb?.failedLoginAttempts}`);

      if (i < 10) {
        expect(res.status, `Attempt ${i} should be 401`).toBe(401);
        expect(userInDb?.failedLoginAttempts).toBe(i);
      } else {
        // The 10th attempt should trigger the lock
        expect(res.status, `Attempt ${i} should be 403`).toBe(403);
        expect(res.body.message).toContain("Account locked");
      }
    }
  }, 15000);

  it("Step 2: should request an unlock email", async () => {
    const response = await request(app)
      .post("/api/auth/unlock/request")
      .send({ email: testUser.email });
    
    expect(response.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: testUser.email } });
    unlockToken = user?.emailVerificationToken as string; 
    expect(unlockToken).toBeDefined();
  });

  it("Step 3: should verify unlock token", async () => {
    const response = await request(app)
      .post(`/api/auth/unlock/verify/${unlockToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.message).toContain("unlocked successfully");

    const user = await prisma.user.findUnique({ where: { email: testUser.email } });
    expect(user?.failedLoginAttempts).toBe(0);
    expect(user?.lockUntil).toBeNull();
  });

  it("Step 4: should login successfully after unlock", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("accessToken");
  });

  afterAll(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { email: testUser.email } });
      if (user) {
        await prisma.patient.deleteMany({ where: { userId: user.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    } catch (e) {}
    await prisma.$disconnect();
  });
});
