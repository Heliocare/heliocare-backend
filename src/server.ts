import "dotenv/config";
import http from "node:http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { Database } from "./lib/prisma.js";
import { SocketServer } from "./lib/socket.js";

// Application server manager
class Server {
  private readonly port: number | string;
  private server: http.Server | null = null;

  constructor() {
    this.port = process.env.PORT as any
  }

  // Start the server
  start(): void {
    const httpServer = http.createServer(app);

    // Initialize Sockets
    SocketServer.init(httpServer);

    this.server = httpServer.listen(this.port, () => {
      logger.info(`Server is running on port ${this.port} (HTTP & WebSockets)`);
    });

    this.registerShutdownHandlers();
  }

  // Register process shutdown handlers
  private registerShutdownHandlers(): void {
    process.on("SIGTERM", () => this.gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => this.gracefulShutdown("SIGINT"));

    process.on("unhandledRejection", (err: Error) => {
      logger.error({ err, stack: err.stack }, `UNHANDLED REJECTION! 💥 ${err.name}: ${err.message}`);
      this.gracefulShutdown("unhandledRejection");
    });

    process.on("uncaughtException", (err: Error) => {
      logger.error({ err, stack: err.stack }, `UNCAUGHT EXCEPTION! 💥 ${err.name}: ${err.message}`);
      process.exit(1);
    });
  }

  // Gracefully shut down the server
  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    if (this.server) {
      this.server.close(async () => {
        logger.info("HTTP server closed.");
        await Database.disconnect();
        logger.info("Database connection closed.");
        process.exit(0);
      });
    }

    // Force close after 10s if graceful shutdown fails
    setTimeout(() => {
      logger.error("Could not close connections in time, forcefully shutting down");
      process.exit(1);
    }, 10000);
  }
}

// Start the application
const server = new Server();
server.start();
