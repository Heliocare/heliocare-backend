export const WA_TEMPLATES = {
    INTAKE_APPROVED: "intake_approved",
    INTAKE_EXCLUDED: "intake_excluded",
    CONSULTATION_APPROVED: "consultation_approved",
    ORDER_DISPATCHED: "order_dispatched",
    CHECKIN_DAY14: "checkin_day14",
    CHECKIN_DAY25: "checkin_day25",
    PAYMENT_FAILED: "payment_failed",
    SUBSCRIPTION_CANCELLED: "subscription_cancelled",
    VIDEO_REMINDER: "video_reminder",
    PATIENT_REASSIGNED: "patient_reassigned",
} as const;

export type WaTemplate = typeof WA_TEMPLATES[keyof typeof WA_TEMPLATES];
