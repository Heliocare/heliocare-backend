import express from "express";
import type { Request, Response, NextFunction } from "express";
import onboardingRoutes from "./routes/onboarding.routes.js";
import intakeRoutes from "./routes/intake.routes.js";

const app = express();

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
    res.send("Vitae Health Intake & Onboarding API");
});

app.use("/api/v1/onboarding", onboardingRoutes);
app.use("/api/v1/intake", intakeRoutes);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(err.status || 500).json({
        success: false,
        error: {
            code: err.code || "INTERNAL_SERVER_ERROR",
            message: err.message || "An internal error occurred"
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
import type { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middleware/errorHandler.js";

const app: Application = express();

// Security Middleware
app.use(helmet());

// CORS configuration based on user constraints
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);

// Rate Limiting (100 requests per 15 minutes)
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

// Health Check Route
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/", (_req: Request, res: Response) => {
  res.send("Heliocare Backend API is running.");
});

// Global Error Handler
app.use(errorHandler);

export default app;
