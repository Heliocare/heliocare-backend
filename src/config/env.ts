import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
    DATABASE_URL: z.string().url().optional(),
    FIELD_ENCRYPTION_KEY: z.string().length(64, "FIELD_ENCRYPTION_KEY must be 32 bytes hex (64 chars)"),
    ENCRYPTION_SALT: z.string().length(32, "ENCRYPTION_SALT must be 16 bytes hex (32 chars)"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_NAME: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().email().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error("Invalid environment variables:", _env.error.format());
    process.exit(1);
}

export const env = _env.data;
