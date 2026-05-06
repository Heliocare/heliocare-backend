import { sendWhatsAppTemplate } from "../whatsapp/sendTemplate.js";
import { WA_TEMPLATES } from "../whatsapp/templates.js";
import { sendEmailTemplate } from "../email/sendEmail.js";
import { EMAIL_TEMPLATES } from "../email/templates.js";

// === WhatsApp Notifications ===

export const notifyIntakeApproved = async (phone: string) => {
    return sendWhatsAppTemplate(phone, WA_TEMPLATES.INTAKE_APPROVED);
};

export const notifyIntakeExcluded = async (phone: string) => {
    return sendWhatsAppTemplate(phone, WA_TEMPLATES.INTAKE_EXCLUDED);
};

export const notifyConsultationApproved = async (phone: string) => {
    return sendWhatsAppTemplate(phone, WA_TEMPLATES.CONSULTATION_APPROVED);
};

export const notifyOrderDispatched = async (phone: string) => {
    return sendWhatsAppTemplate(phone, WA_TEMPLATES.ORDER_DISPATCHED);
};

export const notifyCheckinDay14 = async (phone: string) => {
    return sendWhatsAppTemplate(phone, WA_TEMPLATES.CHECKIN_DAY14);
};

export const notifyCheckinDay25 = async (phone: string) => {
    return sendWhatsAppTemplate(phone, WA_TEMPLATES.CHECKIN_DAY25);
};

export const notifyPaymentFailed = async (phone: string) => {
    return sendWhatsAppTemplate(phone, WA_TEMPLATES.PAYMENT_FAILED);
};

export const notifySubscriptionCancelled = async (phone: string) => {
    return sendWhatsAppTemplate(phone, WA_TEMPLATES.SUBSCRIPTION_CANCELLED);
};

export const notifyVideoReminder = async (phone: string, _slotTime: string) => {
    return sendWhatsAppTemplate(phone, WA_TEMPLATES.VIDEO_REMINDER);
};

// === Email Notifications ===

export const sendVerifyEmail = async (email: string, verificationUrl: string) => {
    return sendEmailTemplate(email, EMAIL_TEMPLATES.VERIFY_EMAIL, { verification_url: verificationUrl });
};

export const sendPaymentReceipt = async (email: string, data: { plan_name: string; amount_naira: string; date: string }) => {
    return sendEmailTemplate(email, EMAIL_TEMPLATES.PAYMENT_RECEIPT, data);
};

export const sendPrescriptionReady = async (email: string, doctorName: string, signedPdfUrl: string) => {
    // Never attach raw prescription PDF — always use signed S3 URL with 15 min TTL
    return sendEmailTemplate(email, EMAIL_TEMPLATES.PRESCRIPTION_READY, {
        doctor_name: doctorName,
        pdf_url: signedPdfUrl
    });
};

export const sendOrderDispatchedEmail = async (email: string, data: { tracking_number: string; logistics_partner: string; est_delivery: string }) => {
    return sendEmailTemplate(email, EMAIL_TEMPLATES.ORDER_DISPATCHED, data);
};

export const sendRenewalReceipt = async (email: string, data: { amount_naira: string; next_billing_date: string }) => {
    return sendEmailTemplate(email, EMAIL_TEMPLATES.RENEWAL_RECEIPT, data);
};

export const sendPasswordReset = async (email: string, resetUrl: string) => {
    return sendEmailTemplate(email, EMAIL_TEMPLATES.PASSWORD_RESET, { reset_url: resetUrl });
};
