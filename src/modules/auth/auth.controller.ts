import type { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service.js";
import { AppError } from "../../utils/AppError.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

const authService = new AuthService();

// Controller class for Authentication HTTP handlers
export class AuthController {
  // Register a new patient
  async register(req: Request<{}, {}, RegisterInput>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.registerPatient(req.body);

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        status: "success",
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Login user
  async login(req: Request<{}, {}, LoginInput>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        status: "success",
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Verify email
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      if (!token || typeof token !== "string") {
        throw new AppError("Verification token is required and must be a string", 400);
      }

      const result = await authService.verifyEmail(token);
      res.status(200).json({ status: "success", ...result });
    } catch (error) {
      next(error);
    }
  }

  // Resend verification
  async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError("User not authenticated", 401);
      const result = await authService.resendVerification(req.user.id);
      res.status(200).json({ status: "success", ...result });
    } catch (error) {
      next(error);
    }
  }

  // Forgot password
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) throw new AppError("Email is required", 400);

      const result = await authService.forgotPassword(email);
      res.status(200).json({ status: "success", ...result });
    } catch (error) {
      next(error);
    }
  }

  // Reset password
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      const { password } = req.body;
      if (!token || typeof token !== "string" || !password) {
        throw new AppError("Token and password are required", 400);
      }

      const result = await authService.resetPassword(token, password);
      res.status(200).json({ status: "success", ...result });
    } catch (error) {
      next(error);
    }
  }

  // Refresh access token
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies.refreshToken;
      if (!token) {
        throw new AppError("Refresh token not found", 401);
      }

      const result = await authService.refreshToken(token);

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        status: "success",
        data: {
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Logout user
  async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie("refreshToken");
    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  }

  // Activate invited staff account
  async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;
      const result = await authService.activateAccount(token, password);
      res.status(200).json({ status: "success", ...result });
    } catch (error) {
      next(error);
    }
  }

  // Export current user data
  async exportMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await authService.exportData(req.user!.id);
      res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  }

  // Request account deletion
  async deleteMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.requestDeletion(req.user!.id);
      res.status(200).json({ status: "success", ...result });
    } catch (error) {
      next(error);
    }
  }

  // MFA Setup: Generate Secret
  async setupMfa(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.generateMfaSecret(req.user!.id);
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }

  // MFA Setup: Verify and Enable
  async verifyAndEnableMfa(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      const result = await authService.enableMfa(req.user!.id, token);
      res.status(200).json({ status: "success", ...result });
    } catch (error) {
      next(error);
    }
  }

  // Request account unlock
  async requestUnlock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const result = await authService.requestUnlock(email);
      res.status(200).json({ status: "success", ...result });
    } catch (error) {
      next(error);
    }
  }

  // Unlock account
  async unlockAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.params.token as string;
      const result = await authService.unlockAccount(token);
      res.status(200).json({ status: "success", ...result });
    } catch (error) {
      next(error);
    }
  }
}
