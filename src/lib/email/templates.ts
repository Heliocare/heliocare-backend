export const EMAIL_TEMPLATES = {
    VERIFY_EMAIL: "d-verify-email-placeholder",
    PAYMENT_RECEIPT: "d-payment-receipt-placeholder",
    PRESCRIPTION_READY: "d-prescription-ready-placeholder",
    ORDER_DISPATCHED: "d-order-dispatched-placeholder",
    RENEWAL_RECEIPT: "d-renewal-receipt-placeholder",
    PASSWORD_RESET: "d-password-reset-placeholder",
} as const;

export type EmailTemplate = typeof EMAIL_TEMPLATES[keyof typeof EMAIL_TEMPLATES];
