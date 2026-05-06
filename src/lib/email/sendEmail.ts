import sgMail from "@sendgrid/mail";
import type { EmailTemplate } from "./templates.js";

let isSendGridInitialized = false;

const initSendGrid = () => {
    if (!isSendGridInitialized && process.env.SENDGRID_API_KEY) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        isSendGridInitialized = true;
    }
};

export const sendEmailTemplate = async (
    to: string,
    templateId: EmailTemplate,
    dynamicTemplateData: Record<string, any> = {}
): Promise<any> => {
    try {
        initSendGrid();

        const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@vitaehealth.ng";

        if (!process.env.SENDGRID_API_KEY) {
            console.warn(`[Email] Skipping ${templateId} send: credentials not configured.`);
            return null;
        }

        const msg: sgMail.MailDataRequired = {
            to,
            from: fromEmail,
            templateId,
            dynamicTemplateData
        };

        const response = await sgMail.send(msg);
        return response[0];
    } catch (error) {
        console.error(`[Email] Failed to send template ${templateId}:`, error);
        throw error;
    }
};
