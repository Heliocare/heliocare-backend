import { prisma } from "../../lib/prisma.js";
import { Password } from "../../utils/password.js";
import { JWT } from "../../utils/jwt.js";
import { Email } from "../../utils/email.js";
import { AppError } from "../../utils/AppError.js";
import crypto from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

// Service class for Authentication business logic
export class AuthService {
  // Registers a new patient
  async registerPatient(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError("Email already in use", 400);
    }

    const hashedPassword = await Password.hash(data.password);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          role: "PATIENT",
          emailVerificationToken: verificationToken,
          emailVerificationExpires: expires,
          patient: {
            create: {
              firstName: data.firstName,
              lastName: data.lastName,
              gender: "NOT_SPECIFIED",
              dob: new Date(0),
              address: "",
              stateOfResidence: "",
              ndprConsentAt: new Date(),
              marketingOptIn: data.marketingOptIn,
            },
          },
        },
        include: {
          patient: true,
        },
      });

      return user;
    });

    // Send verification email
    await Email.sendVerificationEmail(newUser.email, verificationToken);

    const accessToken = JWT.signAccess({ userId: newUser.id, role: newUser.role });
    const refreshToken = JWT.signRefresh({ userId: newUser.id, role: newUser.role });

    await prisma.refreshToken.create({
      data: {
        userId: newUser.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Patients always 7d at registration
      },
    });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        patientId: newUser.patient?.id,
        isEmailVerified: newUser.isEmailVerified,
      },
      accessToken,
      refreshToken,
    };
  }

  // Logs in a user
  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { patient: true, professionalProfile: true },
    });

    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    // Check account lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      throw new AppError(`Account is locked. Please try again in ${remainingMinutes} minutes.`, 403);
    }

    const isPasswordCorrect = await Password.compare(data.password, user.password);

    if (!isPasswordCorrect) {
      // Increment failed attempts
      const attempts = user.failedLoginAttempts + 1;
      const isLocking = attempts >= 10;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockUntil: isLocking ? new Date(2099, 11, 31) : null, // Lock long-term if 10 failed attempts
        },
      });

      if (isLocking) {
        // Trigger account unlock email logic here in next step
        throw new AppError("Account locked due to too many failed attempts. Please check your email to unlock your account.", 403);
      }

      throw new AppError("Invalid email or password", 401);
    }

    if (!user.isActive) {
      throw new AppError("Account is inactive", 403);
    }

    if (!user.isEmailVerified) {
      throw new AppError("Please verify your email before logging in.", 403);
    }

    // Reset failed attempts on success
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Handle MFA if enabled
    if (user.mfaEnabled) {
      return {
        mfaRequired: true,
        userId: user.id,
      };
    }

    const accessToken = JWT.signAccess({ userId: user.id, role: user.role });
    const refreshToken = JWT.signRefresh({ userId: user.id, role: user.role });

    const isProfessional = ["DOCTOR", "PHARMACIST", "LAB_SCIENTIST", "DIETITIAN", "ADMIN", "SUPER_ADMIN"].includes(user.role);
    const refreshExpiry = isProfessional ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    await prisma.refreshToken.upsert({
      where: { token: refreshToken },
      update: {
        token: refreshToken,
        expiresAt: new Date(Date.now() + refreshExpiry),
      },
      create: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + refreshExpiry),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        patientId: user.patient?.id,
        professionalId: user.professionalProfile?.id,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken,
      refreshToken,
    };
  }

  // Verify email with token
  async verifyEmail(token: string) {
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AppError("Invalid or expired verification token", 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return { message: "Email verified successfully" };
  }

  // Resend verification email
  async resendVerification(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new AppError("User not found", 404);
    if (user.isEmailVerified) throw new AppError("Email already verified", 400);

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: token,
        emailVerificationExpires: expires,
      },
    });

    await Email.sendVerificationEmail(user.email, token);

    return { message: "Verification email sent" };
  }

  // Forgot password
  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // We return success even if user doesn't exist for security (don't leak emails)
      return { message: "If an account with that email exists, a reset link has been sent." };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });

    await Email.sendPasswordResetEmail(user.email, token);

    return { message: "If an account with that email exists, a reset link has been sent." };
  }

  // Reset password
  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AppError("Invalid or expired reset token", 400);
    }

    const hashedPassword = await Password.hash(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        // Also clear lockout on password reset
        failedLoginAttempts: 0,
        lockUntil: null,
      },
    });

    return { message: "Password reset successful" };
  }

  // Refreshes access token
  async refreshToken(token: string) {
    const decoded = JWT.verifyRefresh(token);

    const savedToken = await prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!savedToken || savedToken.revokedAt || savedToken.expiresAt < new Date()) {
      throw new AppError("Invalid or expired refresh token", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new AppError("User no longer exists", 401);
    }

    const accessToken = JWT.signAccess({ userId: user.id, role: user.role });
    const newRefreshToken = JWT.signRefresh({ userId: user.id, role: user.role });

    const isProfessional = ["DOCTOR", "PHARMACIST", "LAB_SCIENTIST", "DIETITIAN", "ADMIN", "SUPER_ADMIN"].includes(user.role);
    const refreshExpiry = isProfessional ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    await prisma.refreshToken.update({
      where: { id: savedToken.id },
      data: {
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + refreshExpiry),
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  // Exports all data belonging to the user
  async exportData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        patient: {
          include: {
            intakes: true,
            prescriptions: true,
            orders: true,
          },
        },
      },
    });

    if (!user) throw new AppError("User not found", 404);

    // Filter sensitive fields before export
    const { password, passwordResetToken, emailVerificationToken, ...safeData } = user;
    return safeData;
  }

  // Flag account for deletion
  async requestDeletion(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        // In a real system, we might set a 'scheduledForDeletionAt' date
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "ACCOUNT_DELETION_REQUESTED",
        userId,
        entityType: "User",
        entityId: userId,
      },
    });

    return { message: "Your account deletion request has been received and is being processed." };
  }

  // Request an unlock token via email
  async requestUnlock(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { message: "If your account is locked, an unlock link has been sent." };

    if (!user.lockUntil || user.lockUntil < new Date()) {
      return { message: "Account is not locked." };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: token, // Reusing field for unlock token
        emailVerificationExpires: expires,
      },
    });

    await Email.sendUnlockAccountEmail(user.email, token);

    return { message: "If your account is locked, an unlock link has been sent." };
  }

  // Unlock account with token
  async unlockAccount(token: string) {
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    });

    if (!user) throw new AppError("Invalid or expired unlock token", 400);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockUntil: null,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return { message: "Account unlocked successfully. You can now login." };
  }

  // Generate MFA secret
  async generateMfaSecret(userId: string) {
    const secret = generateSecret();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found", 404);

    const otpauthUrl = generateURI({
      issuer: "Heliocare",
      label: user.email,
      secret,
    });

    await prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    return { secret, otpauthUrl };
  }

  // Enable MFA after verification
  async enableMfa(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) throw new AppError("User or MFA secret not found", 404);

    const result = await verify({ token, secret: user.mfaSecret });
    if (!result) throw new AppError("Invalid MFA token", 401);

    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { message: "Multi-factor authentication enabled successfully." };
  }

  // Activate invited staff account
  async activateAccount(token: string, password: string) {
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
        isActive: false,
      },
    });

    if (!user) {
      throw new AppError("Invalid or expired invitation token", 400);
    }

    const hashedPassword = await Password.hash(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isActive: true,
        isEmailVerified: true, // Invitation acts as email verification
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return { message: "Account activated successfully. You can now login." };
  }
}
