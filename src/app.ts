import express from "express";
import type { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

// Route imports
import authRoutes from "./modules/auth/auth.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import onboardingRoutes from "./modules/onboarding/onboarding.routes.js";
import intakeRoutes from "./modules/intake/intake.routes.js";
import prescriptionRoutes from "./modules/prescriptions/prescription.routes.js";
import orderRoutes from "./modules/orders/order.routes.js";
import professionalRoutes from "./modules/professionals/professional.routes.js";

import { ErrorMiddleware } from "./middleware/errorHandler.js";

const app: Application = express();

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Heliocare API",
      version: "1.0.0",
      description: "API Documentation for Heliocare Backend",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT}`,
        description: "Development server",
      },
    ],
  },
  apis: ["./src/modules/**/*.ts"],
};

const swaggerSpecs = swaggerJsdoc(swaggerOptions);

// Security Middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "*"],
    credentials: true,
  })
);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// Health Check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/", (_req: Request, res: Response) => {
  res.send("Heliocare Backend API is running.");
});

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/intake", intakeRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/professionals", professionalRoutes);

// Global Error Handler
app.use(ErrorMiddleware.handle);

export default app;
