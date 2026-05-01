import type { Request, Response, NextFunction } from "express";
import { JWT } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import { prisma } from "../lib/prisma.js";

// Middleware class for authentication and authorization
export class AuthMiddleware {
  static async protect(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      let token: string | undefined;

      if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
      }

      if (!token) {
        throw new AppError("You are not logged in. Please login to get access.", 401);
      }

      // 1. Verify token
      const decoded = JWT.verifyAccess(token);

      // 2. Check if user still exists
      const currentUser = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!currentUser) {
        throw new AppError("The user belonging to this token no longer exists.", 401);
      }

      if (!currentUser.isActive) {
        throw new AppError("User account is inactive.", 403);
      }

      // 3. Grant access
      req.user = {
        id: currentUser.id,
        role: currentUser.role,
      };
      next();
    } catch (error) {
      next(error);
    }
  }

  // Restrict access based on user roles
  static restrictTo(...roles: string[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return next(
          new AppError("You do not have permission to perform this action", 403)
        );
      }
      next();
    };
  }
}
