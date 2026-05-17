import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("Misc Auth Flows (Refresh, Logout, Reset Password, Resend Verify)", () => {
  const testUser = {
    email: `misc-${Date.now()}@example.com`,
    password: "InitialPassword123!",
    firstName: "Misc",
    lastName: "Tester",
    ndprConsent: true,
  };

  let accessToken: string;
  let cookies: any;
  let resetToken: string;

  it("Preparation: Register user", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    expect(response.status).toBe(201);
    accessToken = response.body.data.accessToken;
    // We intentionally don't verify the email yet to test resend verification
  });

  it("should resend verification email", async () => {
    const response = await request(app)
      .post("/api/auth/resend-verification")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toContain("Verification email sent");

    // Manually verify the user now so they can log in
    const user = await prisma.user.findUnique({ where: { email: testUser.email } });
    await request(app).post(`/api/auth/verify-email/${user?.emailVerificationToken}`);
  });

  it("should login and receive tokens", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: testUser.password });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("accessToken");

    accessToken = response.body.data.accessToken;
    // Extract the cookies (which contain the refreshToken)
    cookies = response.headers["set-cookie"];
    expect(cookies).toBeDefined();
  });

  it("should refresh the access token", async () => {
    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookies); // Pass the refresh token cookie

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("accessToken");

    // Check that a new refresh token cookie is set
    expect(response.headers["set-cookie"]).toBeDefined();
    cookies = response.headers["set-cookie"]; // Update cookies for later
  });

  it("should logout successfully", async () => {
    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookies);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Logged out successfully");

    // Cookie should be cleared
    const setCookie = response.headers["set-cookie"]?.[0] || "";
    expect(setCookie).toContain("refreshToken=;");
  });

  it("should request password reset", async () => {
    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: testUser.email });

    expect(response.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: testUser.email } });
    resetToken = user?.passwordResetToken as string;
    expect(resetToken).toBeDefined();
  });

  it("should reset password using token", async () => {
    const response = await request(app)
      .post(`/api/auth/reset-password/${resetToken}`)
      .send({ password: "NewPassword456!" });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain("Password reset successful");
  });

  it("should login successfully with new password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: "NewPassword456!" });

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
    } catch (e) { }
    await prisma.$disconnect();
  });
});
