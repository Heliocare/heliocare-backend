import bcrypt from "bcrypt";

export class Password {
  private static readonly SALT_ROUNDS = 12;

  // Hashes a plain text password.
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  // Compares a plain text password with a hash.
  static async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
