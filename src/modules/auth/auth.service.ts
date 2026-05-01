import { prisma } from "../../lib/prisma.js";
import { Password } from "../../utils/password.js";
import { JWT } from "../../utils/jwt.js";
import { AppError } from "../../utils/AppError.js";
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

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          role: "PATIENT",
          patient: {
            create: {
              firstName: data.firstName,
              lastName: data.lastName,
              gender: "NOT_SPECIFIED",
              dob: new Date(0),
              address: "",
              stateOfResidence: "",
              ndprConsentAt: new Date(),
            },
          },
        },
        include: {
          patient: true,
        },
      });

      return user;
    });

    const accessToken = JWT.signAccess({ userId: newUser.id, role: newUser.role });
    const refreshToken = JWT.signRefresh({ userId: newUser.id, role: newUser.role });

    await prisma.refreshToken.create({
      data: {
        userId: newUser.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        patientId: newUser.patient?.id,
      },
      accessToken,
      refreshToken,
    };
  }

  // Logs in a user
  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { patient: true, doctor: true, pharmacist: true },
    });

    if (!user || !(await Password.compare(data.password, user.password))) {
      throw new AppError("Invalid email or password", 401);
    }

    if (!user.isActive) {
      throw new AppError("Account is inactive", 403);
    }

    const accessToken = JWT.signAccess({ userId: user.id, role: user.role });
    const refreshToken = JWT.signRefresh({ userId: user.id, role: user.role });

    await prisma.refreshToken.upsert({
      where: { token: refreshToken },
      update: {
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      create: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        patientId: user.patient?.id,
        doctorId: user.doctor?.id,
        pharmacistId: user.pharmacist?.id,
      },
      accessToken,
      refreshToken,
    };
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

    await prisma.refreshToken.update({
      where: { id: savedToken.id },
      data: {
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }
}
