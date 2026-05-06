import type { WaTemplate } from "./templates.js";

interface WhatsAppComponent {
    type: "header" | "body" | "button";
    sub_type?: string;
    index?: string;
    parameters: any[];
}

export const sendWhatsAppTemplate = async (
    to: string,
    templateName: WaTemplate,
    languageCode: string = "en",
    components: WhatsAppComponent[] = []
): Promise<any> => {
    try {
        const phoneId = process.env.WA_PHONE_NUMBER_ID;
        const token = process.env.WA_ACCESS_TOKEN;

        if (!phoneId || !token) {
            console.warn(`[WhatsApp] Skipping ${templateName} send: credentials not configured.`);
            return null;
        }

        const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
        const payload = {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
                name: templateName,
                language: { code: languageCode },
                components
            }
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`WhatsApp API Error: ${JSON.stringify(data)}`);
        }

        return data;
    } catch (error) {
        // Log template and error, NEVER the phone number
        console.error(`[WhatsApp] Failed to send template ${templateName}:`, error);
        throw error;
    }
};
