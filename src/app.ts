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