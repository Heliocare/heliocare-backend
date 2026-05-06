import "dotenv/config";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { PrismaClient } from "./generated/prisma/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

// Graceful Shutdown gracefully handles killing the server
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    logger.info("HTTP server closed.");
    await prisma.$disconnect();
    logger.info("Database connection closed.");
    process.exit(0);
  });

  // Force close after 10s if graceful shutdown fails
  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Catch Unhandled Rejections and Exceptions
process.on("unhandledRejection", (err: Error) => {
  logger.error({ err, stack: err.stack }, `UNHANDLED REJECTION! 💥 Shutting down... ${err.name}: ${err.message}`);
  gracefulShutdown("unhandledRejection");
});

process.on("uncaughtException", (err: Error) => {
  logger.error({ err, stack: err.stack }, `UNCAUGHT EXCEPTION! 💥 Shutting down... ${err.name}: ${err.message}`);
  process.exit(1); // Force exit on uncaught exception
});
