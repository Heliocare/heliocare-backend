import type { Response } from "express";

export const sendSuccess = <T>(res: Response, data?: T, statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        data
    });
};

export const sendError = (res: Response, message: string, code: string, statusCode = 400) => {
    res.status(statusCode).json({
        success: false,
        error: {
            code,
            message
        }
    });
};

export const sendValidationError = (res: Response, fields: Record<string, string>) => {
    res.status(422).json({
        success: false,
        error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            fields
        }
    });
};
