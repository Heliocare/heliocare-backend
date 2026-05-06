import nodemailer from "nodemailer";
import { logger } from "../lib/logger.js";

/**
 * Utility class for sending emails
 */
export class Email {
  private static readonly FROM = process.env.EMAIL_FROM || "Heliocare <no-reply@heliocare.com>";

  /**
   * Sends a verification email to a new user
   */
  static async sendVerificationEmail(to: string, token: string): Promise<void> {
    const url = `${process.env.FRONTEND_URL || "http://localhost:3000"}/verify-email?token=${token}`;
    const subject = "Verify your Heliocare account";
    const text = `Welcome to Heliocare! Please verify your account by clicking the link below:\n\n${url}`;
    const html = `
      <h1>Welcome to Heliocare</h1>
      <p>Please verify your account by clicking the button below:</p>
      <a href="${url}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
      <p>Or copy this link: ${url}</p>
    `;

    await this.send(to, subject, text, html);
  }

  /**
   * Sends a password reset email
   */
  static async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const url = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}`;
    const subject = "Reset your Heliocare password";
    const text = `You requested a password reset. Please click the link below to set a new password:\n\n${url}`;
    const html = `
      <h1>Reset Your Password</h1>
      <p>Click the button below to set a new password. This link expires in 1 hour.</p>
      <a href="${url}" style="padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>Or copy this link: ${url}</p>
    `;

    await this.send(to, subject, text, html);
  }

  /**
   * Internal method to handle the actual sending logic
   */
  private static async send(to: string, subject: string, text: string, html: string): Promise<void> {
    // In development, we just log to the console
    if (process.env.NODE_ENV === "development" || !process.env.SMTP_HOST) {
      logger.info(`[EMAIL_DEV] To: ${to} | Subject: ${subject}`);
      logger.info(`[EMAIL_DEV] Text: ${text}`);
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: this.FROM,
        to,
        subject,
        text,
        html,
      });

      logger.info(`Email sent successfully to ${to}`);
    } catch (error) {
      logger.error({ error }, `Failed to send email to ${to}`);
      // We don't throw here to avoid crashing the request, but we log it
    }
  }
}
