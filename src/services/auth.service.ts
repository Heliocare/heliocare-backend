import { sendPasswordReset } from "../lib/notifications/index.js";

export const AuthService = {
    requestPasswordReset: async (email: string, resetUrl: string) => {
        // Stub: Token generation
        sendPasswordReset(email, resetUrl).catch(() => { });
    }
};
