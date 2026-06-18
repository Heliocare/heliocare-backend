import { Resend } from "resend";
import { logger } from "../logger.js";

// ── Configuration ──────────────────────────────────────────────

const FROM_NAME = "Heliocare";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const FROM = `${FROM_NAME} <${FROM_EMAIL}>`;
const FRONTEND_URL = process.env.FRONTEND_URL

const getResend = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

// ── Low-level Send ─────────────────────────────────────────────

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export const sendEmail = async ({ to, subject, html, text }: SendOptions): Promise<void> => {
  const resend = getResend();

  if (!resend || process.env.NODE_ENV === "development") {
    logger.info(`[EMAIL_DEV] To: ${to} | Subject: ${subject}`);
    logger.info(`[EMAIL_DEV] Text: ${text}`);
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      logger.error({ error }, `Failed to send email to ${to}`);
      return;
    }

    logger.info(`Email sent successfully to ${to} (id: ${data?.id})`);
  } catch (err) {
    logger.error({ err }, `Failed to send email to ${to}`);
  }
};

// ── Auth / Account Emails ──────────────────────────────────────

export const sendVerificationEmail = async (to: string, token: string): Promise<void> => {
  const url = `${FRONTEND_URL}/verify-email?token=${token}`;
  const subject = "Verify your Heliocare account";
  const text = `Welcome to Heliocare! Please verify your account by clicking the link below:\n\n${url}`;
  const html = `
    <h1>Welcome to Heliocare</h1>
    <p>Please verify your account by clicking the button below:</p>
    <a href="${url}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
    <p>Or copy this link: ${url}</p>
  `;
  await sendEmail({ to, subject, html, text });
};

export const sendPasswordResetEmail = async (to: string, token: string): Promise<void> => {
  const url = `${FRONTEND_URL}/reset-password?token=${token}`;
  const subject = "Reset your Heliocare password";
  const text = `You requested a password reset. Please click the link below to set a new password:\n\n${url}`;
  const html = `
    <h1>Reset Your Password</h1>
    <p>Click the button below to set a new password. This link expires in 1 hour.</p>
    <a href="${url}" style="padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
    <p>Or copy this link: ${url}</p>
  `;
  await sendEmail({ to, subject, html, text });
};

export const sendInvitationEmail = async (to: string, token: string): Promise<void> => {
  const url = `${FRONTEND_URL}/activate?token=${token}`;
  const subject = "Invitation to join Heliocare";
  const text = `You have been invited to join the Heliocare clinical team. Please click the link below to set up your account:\n\n${url}`;
  const html = `
    <h1>Join the Heliocare Team</h1>
    <p>You have been invited to join the clinical team. Click the button below to set up your password and complete your profile. This link expires in 48 hours.</p>
    <a href="${url}" style="padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">Set Up Account</a>
    <p>Or copy this link: ${url}</p>
  `;
  await sendEmail({ to, subject, html, text });
};

export const sendUnlockAccountEmail = async (to: string, token: string): Promise<void> => {
  const url = `${FRONTEND_URL}/unlock-account?token=${token}`;
  const subject = "Unlock your Heliocare account";
  const text = `Your account has been locked due to multiple failed login attempts. Click the link below to unlock it:\n\n${url}`;
  const html = `
    <h1>Unlock Your Account</h1>
    <p>Your account was locked for security. Click the button below to restore access:</p>
    <a href="${url}" style="padding: 10px 20px; background-color: #ffc107; color: black; text-decoration: none; border-radius: 5px;">Unlock Account</a>
    <p>Or copy this link: ${url}</p>
  `;
  await sendEmail({ to, subject, html, text });
};

export const sendDeletionConfirmation = async (to: string, scheduledDate: Date): Promise<void> => {
  const dateStr = scheduledDate.toISOString().split("T")[0];
  const subject = "Your Heliocare account deletion request";
  const text =
    `We have received your request to delete your Heliocare account and all associated data.\n\n` +
    `Your data will be permanently erased on ${dateStr}, after a 30-day grace period. ` +
    `If you did not make this request, please contact our support team immediately to restore your account.\n\n` +
    `- The Heliocare Team`;
  const html = `
    <h1>Account Deletion Scheduled</h1>
    <p>We have received your request to delete your Heliocare account and all associated data.</p>
    <p><strong>Your data will be permanently erased on ${dateStr}</strong>, after a 30-day grace period.</p>
    <p>If you did not make this request, please contact our support team immediately to restore your account.</p>
    <p style="color: #666;">- The Heliocare Team</p>
  `;
  await sendEmail({ to, subject, html, text });
};

// ── Notification-style Emails (formerly SendGrid templates) ────

export const sendVerifyEmail = async (email: string, verificationUrl: string): Promise<void> => {
  const subject = "Verify your email address";
  const text = `Please verify your email address by clicking the link below:\n\n${verificationUrl}`;
  const html = `
    <h1>Verify Your Email</h1>
    <p>Click the button below to verify your email address:</p>
    <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
    <p>Or copy this link: ${verificationUrl}</p>
  `;
  await sendEmail({ to: email, subject, html, text });
};

export const sendPaymentReceipt = async (
  email: string,
  data: { plan_name: string; amount_naira: string; date: string }
): Promise<void> => {
  const subject = `Payment Receipt — ${data.plan_name}`;
  const text =
    `Thank you for your payment!\n\n` +
    `Plan: ${data.plan_name}\n` +
    `Amount: ₦${data.amount_naira}\n` +
    `Date: ${data.date}\n\n` +
    `- The Heliocare Team`;
  const html = `
    <h1>Payment Receipt</h1>
    <p>Thank you for your payment!</p>
    <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Plan</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.plan_name}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₦${data.amount_naira}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Date</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.date}</td></tr>
    </table>
    <p style="color: #666;">- The Heliocare Team</p>
  `;
  await sendEmail({ to: email, subject, html, text });
};

export const sendPrescriptionReady = async (
  email: string,
  doctorName: string,
  signedPdfUrl: string
): Promise<void> => {
  const subject = "Your Prescription is Ready";
  const text =
    `Your prescription from Dr. ${doctorName} is ready.\n\n` +
    `You can view and download it here: ${signedPdfUrl}\n\n` +
    `- The Heliocare Team`;
  const html = `
    <h1>Prescription Ready</h1>
    <p>Your prescription from <strong>Dr. ${doctorName}</strong> is ready.</p>
    <a href="${signedPdfUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Prescription</a>
    <p style="color: #666;">This link expires in 15 minutes.</p>
    <p style="color: #666;">- The Heliocare Team</p>
  `;
  await sendEmail({ to: email, subject, html, text });
};

export const sendOrderDispatchedEmail = async (
  email: string,
  data: { tracking_number: string; logistics_partner: string; est_delivery: string }
): Promise<void> => {
  const subject = "Your Order Has Been Dispatched";
  const text =
    `Your order is on its way!\n\n` +
    `Tracking Number: ${data.tracking_number}\n` +
    `Logistics Partner: ${data.logistics_partner}\n` +
    `Estimated Delivery: ${data.est_delivery}\n\n` +
    `- The Heliocare Team`;
  const html = `
    <h1>Order Dispatched</h1>
    <p>Your order is on its way!</p>
    <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Tracking Number</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.tracking_number}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Logistics Partner</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.logistics_partner}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Est. Delivery</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.est_delivery}</td></tr>
    </table>
    <p style="color: #666;">- The Heliocare Team</p>
  `;
  await sendEmail({ to: email, subject, html, text });
};

export const sendRenewalReceipt = async (
  email: string,
  data: { amount_naira: string; next_billing_date: string }
): Promise<void> => {
  const subject = "Subscription Renewal Receipt";
  const text =
    `Your subscription has been renewed.\n\n` +
    `Amount: ₦${data.amount_naira}\n` +
    `Next Billing Date: ${data.next_billing_date}\n\n` +
    `- The Heliocare Team`;
  const html = `
    <h1>Renewal Receipt</h1>
    <p>Your subscription has been renewed successfully.</p>
    <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₦${data.amount_naira}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Next Billing</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.next_billing_date}</td></tr>
    </table>
    <p style="color: #666;">- The Heliocare Team</p>
  `;
  await sendEmail({ to: email, subject, html, text });
};

// ── Custom / Ad-hoc Email ───────────────────────────────────────

export const sendCustomEmail = async (to: string, subject: string, body: string): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${body}
    </div>
  `;
  await sendEmail({ to, subject, html, text: body.replace(/<[^>]*>/g, "") });
};

export const sendPasswordReset = async (email: string, resetUrl: string): Promise<void> => {
  const subject = "Reset your Heliocare password";
  const text = `You requested a password reset. Please click the link below to set a new password:\n\n${resetUrl}`;
  const html = `
    <h1>Reset Your Password</h1>
    <p>Click the button below to set a new password. This link expires in 1 hour.</p>
    <a href="${resetUrl}" style="padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
    <p>Or copy this link: ${resetUrl}</p>
  `;
  await sendEmail({ to: email, subject, html, text });
};
