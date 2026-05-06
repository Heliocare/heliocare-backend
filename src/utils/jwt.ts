import jwt from "jsonwebtoken";

export interface TokenPayload {
  userId: string;
  role: string;
}

export class JWT {
  private static readonly ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as any
  private static readonly REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as any

  // Signs an access token (short-lived: 15m).
  static signAccess(payload: TokenPayload): string {
    return jwt.sign(payload, this.ACCESS_SECRET, { expiresIn: "15m" });
  }

  // Signs a refresh token (long-lived: 7d).
  static signRefresh(payload: TokenPayload): string {
    return jwt.sign(payload, this.REFRESH_SECRET, { expiresIn: "7d" });
  }

  // Verifies an access token.
  static verifyAccess(token: string): TokenPayload {
    return jwt.verify(token, this.ACCESS_SECRET) as TokenPayload;
  }
  // Verifies a refresh token.
  static verifyRefresh(token: string): TokenPayload {
    return jwt.verify(token, this.REFRESH_SECRET) as TokenPayload;
  }
}
