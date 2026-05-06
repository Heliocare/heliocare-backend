import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "node:http";
import { logger } from "./logger.js";
import { JWT } from "../utils/jwt.js";
import { MessageService } from "../modules/messaging/message.service.js";

const messageService = new MessageService();

export class SocketServer {
  private static io: SocketIOServer;

  static init(httpServer: HTTPServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*", // Adjust in production
        methods: ["GET", "POST"],
      },
    });

    // Authentication Middleware for Sockets
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
      
      if (!token) {
        return next(new Error("Authentication error: Token missing"));
      }

      try {
        const decoded = JWT.verifyAccess(token);
        (socket as any).user = decoded;
        next();
      } catch (err) {
        next(new Error("Authentication error: Invalid token"));
      }
    });

    this.io.on("connection", (socket) => {
      const user = (socket as any).user;
      logger.info(`User connected to socket: ${user.userId} (${user.role})`);

      // 1. Join user-specific room
      socket.join(user.userId);

      // 2. Join conversation room (PatientId + DoctorId)
      socket.on("join_conversation", (data: { patientId: string; doctorId: string }) => {
        const roomName = `chat_${data.patientId}_${data.doctorId}`;
        socket.join(roomName);
        logger.debug(`User ${user.userId} joined room: ${roomName}`);
      });

      // 3. Handle incoming message
      socket.on("send_message", async (data: { patientId: string; doctorId: string; content: string }) => {
        try {
          const roomName = `chat_${data.patientId}_${data.doctorId}`;
          
          // Save to DB (Encrypted)
          const savedMsg = await messageService.saveMessage(user.userId, user.role as "PATIENT" | "DOCTOR", {
            patientId: data.patientId,
            doctorId: data.doctorId,
            content: data.content,
          });

          // Emit to the room (Decrypted for participants)
          this.io.to(roomName).emit("receive_message", savedMsg);
          
          // Also emit a notification to the recipient's personal room
          const recipientId = user.role === "PATIENT" ? data.doctorId : data.patientId;
          this.io.to(recipientId).emit("new_message_notification", {
            from: user.userId,
            preview: data.content.substring(0, 50),
          });

        } catch (error) {
          logger.error({ error }, "Error in socket send_message");
          socket.emit("error", { message: "Failed to send message" });
        }
      });

      // 4. Handle typing indicators
      socket.on("typing_start", (data: { patientId: string; doctorId: string }) => {
        const roomName = `chat_${data.patientId}_${data.doctorId}`;
        socket.to(roomName).emit("typing_start", { userId: user.userId });
      });

      socket.on("typing_stop", (data: { patientId: string; doctorId: string }) => {
        const roomName = `chat_${data.patientId}_${data.doctorId}`;
        socket.to(roomName).emit("typing_stop", { userId: user.userId });
      });

      socket.on("disconnect", () => {
        logger.info(`User disconnected from socket: ${user.userId}`);
      });
    });

    return this.io;
  }

  static getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error("Socket.io not initialized!");
    }
    return this.io;
  }
}
