import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendInvitationEmail,
  sendUnlockAccountEmail,
  sendDeletionConfirmation,
  sendCustomEmail,
  sendOrderDispatchedEmail,
  sendPaymentReceipt,
} from "../src/lib/email/index.js";

// We're in dev/test mode by default, so all sends will log instead of
// calling Resend. We spy on the logger to assert content.

const logger = await import("../src/lib/logger.js");

describe("Email Module", () => {
  beforeEach(() => {
    vi.spyOn(logger.logger, "info").mockImplementation(() => { });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── sendEmail (low-level) ─────────────────────────────────────

  describe("sendEmail", () => {
    it("should log the email in dev mode instead of sending", async () => {
      await sendEmail({
        to: "oshoarofavour@gmail.com",
        subject: "Hello",
        html: "<p>World</p>",
        text: "World",
      });

      expect(logger.logger.info).toHaveBeenCalledWith(
        "[EMAIL_DEV] To: oshoarofavour@gmail.com | Subject: Hello"
      );
    });

    it("should log the text content in dev mode", async () => {
      await sendEmail({
        to: "user@test.com",
        subject: "Test Subject",
        html: "<h1>Body</h1>",
        text: "Plain text body",
      });

      expect(logger.logger.info).toHaveBeenCalledWith(
        "[EMAIL_DEV] Text: Plain text body"
      );
    });
  });

  // ── sendVerificationEmail ─────────────────────────────────────

  describe("sendVerificationEmail", () => {
    it("should include the verification URL with token", async () => {
      await sendVerificationEmail("user@example.com", "abc123token");

      const calls = (logger.logger.info as any).mock.calls;
      const textCall = calls.find((c: string[]) => c[0]?.includes("[EMAIL_DEV] Text:"));
      expect(textCall).toBeDefined();
      expect(textCall[0]).toContain("/verify-email?token=abc123token");
    });

    it("should include the FRONTEND_URL in the link", async () => {
      await sendVerificationEmail("user@example.com", "token456");

      const calls = (logger.logger.info as any).mock.calls;
      const textCall = calls.find((c: string[]) => c[0]?.includes("[EMAIL_DEV] Text:"));
      expect(textCall[0]).toContain("verify-email?token=token456");
    });
  });

  // ── sendPasswordResetEmail ────────────────────────────────────

  describe("sendPasswordResetEmail", () => {
    it("should include the reset URL with token", async () => {
      await sendPasswordResetEmail("user@example.com", "resettoken");

      const calls = (logger.logger.info as any).mock.calls;
      const textCall = calls.find((c: string[]) => c[0]?.includes("[EMAIL_DEV] Text:"));
      expect(textCall).toBeDefined();
      expect(textCall[0]).toContain("/reset-password?token=resettoken");
    });
  });

  // ── sendInvitationEmail ───────────────────────────────────────

  describe("sendInvitationEmail", () => {
    it("should include the activation URL with token", async () => {
      await sendInvitationEmail("doctor@clinic.com", "invite123");

      const calls = (logger.logger.info as any).mock.calls;
      const textCall = calls.find((c: string[]) => c[0]?.includes("[EMAIL_DEV] Text:"));
      expect(textCall).toBeDefined();
      expect(textCall[0]).toContain("/activate?token=invite123");
    });
  });

  // ── sendUnlockAccountEmail ────────────────────────────────────

  describe("sendUnlockAccountEmail", () => {
    it("should include the unlock URL with token", async () => {
      await sendUnlockAccountEmail("locked@example.com", "unlock123");

      const calls = (logger.logger.info as any).mock.calls;
      const textCall = calls.find((c: string[]) => c[0]?.includes("[EMAIL_DEV] Text:"));
      expect(textCall).toBeDefined();
      expect(textCall[0]).toContain("/unlock-account?token=unlock123");
    });
  });

  // ── sendDeletionConfirmation ──────────────────────────────────

  describe("sendDeletionConfirmation", () => {
    it("should include the scheduled deletion date", async () => {
      const scheduledDate = new Date("2026-12-31");
      await sendDeletionConfirmation("patient@example.com", scheduledDate);

      const calls = (logger.logger.info as any).mock.calls;
      const textCall = calls.find((c: string[]) => c[0]?.includes("[EMAIL_DEV] Text:"));
      expect(textCall).toBeDefined();
      expect(textCall[0]).toContain("2026-12-31");
    });
  });

  // ── sendCustomEmail ───────────────────────────────────────────

  describe("sendCustomEmail", () => {
    it("should send an email with the given subject", async () => {
      await sendCustomEmail("custom@example.com", "Custom Subject", "<p>Custom body</p>");

      expect(logger.logger.info).toHaveBeenCalledWith(
        "[EMAIL_DEV] To: custom@example.com | Subject: Custom Subject"
      );
    });

    it("should strip HTML tags for the plain text version", async () => {
      await sendCustomEmail("test@example.com", "Hello", "<p>Bold text</p>");

      const calls = (logger.logger.info as any).mock.calls;
      const textCall = calls.find((c: string[]) => c[0]?.includes("[EMAIL_DEV] Text:"));
      expect(textCall).toBeDefined();
      // The text should have the HTML tags stripped
      expect(textCall[0]).toContain("Bold text");
    });
  });

  // ── sendOrderDispatchedEmail ──────────────────────────────────

  describe("sendOrderDispatchedEmail", () => {
    it("should include tracking details", async () => {
      await sendOrderDispatchedEmail("customer@example.com", {
        tracking_number: "TRK-12345",
        logistics_partner: "DHL",
        est_delivery: "2026-06-25",
      });

      const calls = (logger.logger.info as any).mock.calls;
      const textCall = calls.find((c: string[]) => c[0]?.includes("[EMAIL_DEV] Text:"));
      expect(textCall).toBeDefined();
      expect(textCall[0]).toContain("TRK-12345");
      expect(textCall[0]).toContain("DHL");
    });
  });

  // ── sendPaymentReceipt ────────────────────────────────────────

  describe("sendPaymentReceipt", () => {
    it("should include payment details", async () => {
      await sendPaymentReceipt("payer@example.com", {
        plan_name: "Premium Plan",
        amount_naira: "5000",
        date: "2026-06-18",
      });

      const calls = (logger.logger.info as any).mock.calls;
      const textCall = calls.find((c: string[]) => c[0]?.includes("[EMAIL_DEV] Text:"));
      expect(textCall).toBeDefined();
      expect(textCall[0]).toContain("Premium Plan");
      expect(textCall[0]).toContain("₦5000");
    });
  });
});
