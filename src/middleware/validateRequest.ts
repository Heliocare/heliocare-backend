import type { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";

export const validateRequest = (schema: z.ZodTypeAny) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await schema.parseAsync(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const fields: Record<string, string> = {};
                error.issues.forEach((issue) => {
                    fields[issue.path.join(".")] = issue.message;
                });
                res.status(422).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Validation failed",
                        fields
                    }
                });
                return;
            }
            next(error);
        }
    };
};
