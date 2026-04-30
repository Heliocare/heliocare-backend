import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";

// Configure logger based on environment
export const logger = isDevelopment
  ? pino({
    level: "debug",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
      },
    },
  })
  : pino({
    level: "info",
  });
