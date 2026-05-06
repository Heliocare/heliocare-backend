import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";
import { AppError } from "../utils/AppError.js";
import { logger } from "../lib/logger.js";

// Middleware class for error handling and validation
export class ErrorMiddleware {
  static handle(
    err: Error | AppError | ZodError,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void {
    if (err instanceof ZodError) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: err.issues,
      });
      return;
    }

    if (err instanceof AppError) {
      if (!err.isOperational) {
        logger.error({ err, stack: err.stack }, `[UNEXPECTED_ERROR] ${err.message}`);
      } else {
        logger.warn(`[OPERATIONAL_ERROR] ${err.message}`);
      }

      res.status(err.statusCode).json({
        status: "error",
        message: err.message,
        errorCode: err.errorCode,
      });
      return;
    }

    // Generic unhandled errors
    logger.error({ err, stack: err.stack }, `[UNHANDLED_ERROR] ${err.message}`);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
  }

  // Validates request body/query/params against a Zod schema
  static validate(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction) => {
      try {
        schema.parse({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        next();
      } catch (error) {
        next(error);
      }
    };
  }
}
