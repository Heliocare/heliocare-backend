import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

// Middleware to validate request data against a Zod schema
export const validateResource =
  (schema: ZodSchema) =>
    (req: Request, _res: Response, next: NextFunction) => {
      try {
        schema.parse({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        next();
      } catch (error: any) {
        next(error); // This will pass the ZodError to the global error handler
      }
    };
