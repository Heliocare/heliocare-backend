import { prisma } from "../../lib/prisma.js";
import { Crypto } from "../../utils/crypto.js";
import type { SendMessageInput } from "./message.schema.js";

export class MessageService {
  // Saves an encrypted message to the database
  async saveMessage(_senderId: string, senderRole: "PATIENT" | "DOCTOR", data: SendMessageInput) {
    // 1. Encrypt the content
    const contentEnc = Crypto.encrypt(data.content);

    // 2. Save to DB
    const message = await prisma.message.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId || null,
        sender: senderRole,
        contentEnc: contentEnc,
      },
    });

    // 3. Return decrypted version for the UI
    return {
      ...message,
      content: data.content,
    };
  }

  // Fetches and decrypts message history for a conversation
  async getConversationHistory(patientId: string, doctorId?: string) {
    const messages = await prisma.message.findMany({
      where: {
        patientId,
        ...(doctorId && { doctorId }),
      },
      orderBy: { createdAt: "asc" },
    });

    return messages.map((msg) => {
      try {
        return {
          ...msg,
          content: Crypto.decrypt(msg.contentEnc),
        };
      } catch (error) {
        return {
          ...msg,
          content: "[Error decrypting message]",
        };
      }
    });
  }

  // Marks messages as read
  async markAsRead(patientId: string, doctorId: string, readerRole: "PATIENT" | "DOCTOR") {
    await prisma.message.updateMany({
      where: {
        patientId,
        doctorId,
        sender: readerRole === "PATIENT" ? "DOCTOR" : "PATIENT",
        isRead: false,
      },
      data: { isRead: true },
    });
  }
}
