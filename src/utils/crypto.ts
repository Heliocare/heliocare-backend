import crypto from "node:crypto";

// Used for securing sensitive medical data (Messaging and PII).
export class Crypto {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly KEY = Buffer.from(process.env.ENCRYPTION_KEY as string, "hex");
  private static readonly IV_LENGTH = 16;

  // Encrypts a plain text string.
  static encrypt(text: string): string {
    if (this.KEY.length !== 32) {
      throw new Error("Invalid ENCRYPTION_KEY. Must be a 32-byte hex string (64 characters).");
    }

    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.KEY, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  // Decrypts an encrypted string in the format: iv:authTag:encryptedData
  static decrypt(hash: string): string {
    const [ivHex, authTagHex, encryptedHex] = hash.split(":");

    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error("Invalid encrypted format. Expected iv:authTag:encryptedData");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.KEY, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
