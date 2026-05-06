import type { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response.js";
import { prisma } from "../prisma/client.js";

export interface JwtPayload {
    id: string;
    role: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export const verifyAccessToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        sendError(res, "Missing or invalid token", "UNAUTHORIZED", 401);
        return;
    }

    const parts = authHeader.slice(7).split(":");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        sendError(res, "Invalid mock token format. Use Bearer <userId>:<role>", "UNAUTHORIZED", 401);
        return;
    }

    const id = parts[0];
    const role = parts[1];

    try {
        let user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            user = await prisma.user.create({ data: { id } });
        }
        req.user = { id: user.id, role };
        next();
    } catch (e) {
        sendError(res, "Database error processing auth token check", "INTERNAL_ERROR", 500);
    }
};

export const requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            sendError(res, "Unauthorized", "UNAUTHORIZED", 401);
            return;
        }
        if (!roles.includes(req.user.role)) {
            sendError(res, "Forbidden: insufficient permissions", "FORBIDDEN", 403);
            return;
        }
        next();
    };
};
