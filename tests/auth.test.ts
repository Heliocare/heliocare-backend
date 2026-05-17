import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("Auth Flow Integration", () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: "Password123!",
    firstName: "Test",
    lastName: "User",
    ndprConsent: true,
    marketingOptIn: true,
  };

  let accessToken: string;
  let verificationToken: string;

  // Step 1: Register
  it("Step 1: should register a new user", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(testUser);
    
    expect(response.status).toBe(201);
    expect(response.body.status).toBe("success");

    // Get the verification token from DB
    const user = await prisma.user.findUnique({
      where: { email: testUser.email }
    });
    verificationToken = user?.emailVerificationToken as string;
    expect(verificationToken).toBeDefined();
  });

  // Step 2: Verify Email
  it("Step 2: should verify the user email", async () => {
    const response = await request(app)
      .post(`/api/auth/verify-email/${verificationToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");

    const user = await prisma.user.findUnique({
      where: { email: testUser.email }
    });
    expect(user?.isEmailVerified).toBe(true);
  });

  // Step 3: Login
  it("Step 3: should login and return tokens", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("accessToken");
    accessToken = response.body.data.accessToken;
  });

  // Step 4: Export Data
  it("Step 4: should export patient data", async () => {
    const response = await request(app)
      .get("/api/auth/me/export")
      .set("Authorization", `Bearer ${accessToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.email).toBe(testUser.email);
  });

  // Step 5: Delete Account
  it("Step 5: should flag account for deletion", async () => {
    const response = await request(app)
      .delete("/api/auth/me/deletion")
      .set("Authorization", `Bearer ${accessToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  afterAll(async () => {
    // Cleanup the test user
    try {
      const user = await prisma.user.findUnique({ where: { email: testUser.email } });
      if (user) {
        await prisma.patient.deleteMany({ where: { userId: user.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    } catch (e) {
      console.error("Cleanup failed:", e);
    }
    await prisma.$disconnect();
  });
});
