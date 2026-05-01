import { PrismaClient } from "../generated/prisma/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton Database connection manager
export class Database {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!Database.instance) {
      const { Pool } = pg;
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const adapter = new PrismaPg(pool);
      Database.instance = new PrismaClient({ adapter });
    }
    return Database.instance;
  }

  // Disconnect from the database
  static async disconnect(): Promise<void> {
    if (Database.instance) {
      await Database.instance.$disconnect();
    }
  }
}

// Convenience export
export const prisma = Database.getInstance();
